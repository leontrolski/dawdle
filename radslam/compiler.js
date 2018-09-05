const {fullParser, types, is, assertIs, baseOperatorInverseMap} = require('./parser')
const {errors, asserters, log} = require('./errorsAndAsserters')

const R = require('ramda')

/**
 * Given a list of values, return the list, but with the
 * sets splatted in place.
 *
 * eg:  a b [c d e] f -> a b c d e f
 */
const splatSets = list=>{
    let listOut = []
    for(let o of list){
        if(is.set(o)) listOut = listOut.concat(o.value)
        else listOut.push(o)
    }
    return listOut
}

/**
 * Map of base operator type to a function that determines
 * the headers for that type. Function signatures are useful
 * in that they specll out the operator's signature.
 */
const determineHeaders = {
    filter: (rel, func, ...values)=>rel.headers,
    select: (rel, ...headers)=>headers,
    extend: (rel, header, func, ...values)=>R.union(rel.headers, [header]),
    cross: (rel, value)=>rel.headers.concat(value.headers),
    union: (rel, value)=>rel.headers,
    difference: (rel, value)=>rel.headers,
    join: (rel, value)=>R.union(rel.headers, value.headers),
    group: (rel, ...headers_aggregators)=>{
        const [aggregators, ...headers] = headers_aggregators.reverse()
        return headers.reverse().concat(aggregators.headers)
    }
}
/**
 * Similar to determineHeaders, but for sets.
 *
 * TODO: maybe implement cross product.
 */
const determineSet = {
    union: (set, ...rest)=>R.union(set.value, rest),
    difference: (set, ...rest)=>R.difference(set.value, rest),
}

/**
 * For a section of relation operations, return the calculated headers.
 *
 * TODO: handle named_var.
 */
const doRelationHeaderOperations = (env, firstRelation, lines)=>{
    const accum = [firstRelation]
    for(let line of lines){
        if(is.map_macro(line)){
            const expanded = expandAndRegisterMacro(env, line)
            line = expanded.line
            env = addRegistration(env, expanded.registration)
        }
        let [operator, ...args] = line.value

        let finalSection  // if the line ends with a section
        if(args.length > 0 && is.section(R.last(args))) finalSection = args.pop()

        // resolve args and splat sets
        args = splatSets(args.map(o=>resolve(env, o))).map(o=>resolve(env, o))
        // prepend args with the previous value
        args = [R.last(accum)].concat(args)
        // append final section to args if it exists
        if(!R.isNil(finalSection)) args.push(compileHeaders(env, finalSection))

        let newHeaders
        if(is.baseOperator(operator)){
            const operatorName = baseOperatorInverseMap[operator.value]
            asserters.assertArgs[operatorName](...args)
            newHeaders = {headers: determineHeaders[operatorName](...args)}
        } else {
            const operator_ = resolve(env, operator)
            asserters.assertOperatorArgsMatch(operator_.args, args)
            // contruct env for operator, then compile its section with it
            let operatorEnv = env
            for(let [operatorArg, arg] of R.zip(operator_.args, args)){
                operatorEnv = addRegistration(operatorEnv, registerOperatorArg(operatorArg, arg))
            }
            newHeaders = compileHeaders(operatorEnv, operator_.operator_section)
        }
        const newValue = R.merge({type: types.relation}, newHeaders)
        accum.push(newValue)
    }
    return R.merge(R.last(accum), {accum: R.init(accum)})
}
/**
 * For a section of set operations, return the calculated set values.
 *
 * TODO: handle indented sections.
 * TODO: handle macros.
 * TODO: handle composite operators.
 * TODO: assert the arguments to the operator match its signature.
 * TODO: handle named_var.
 *
 * See `doRelationHeaderOperations` for examples of the above.
 */
const doSetOperations = (env, firstSet, lines)=>{
    const accum = [firstSet]
    for(let line of lines){
        if(is.section(line)) continue  // these will be handled below
        let [operator, ...args] = line.value
        // resolve args and splat sets
        args = splatSets(args.map(o=>resolve(env, o))).map(o=>resolve(env, o))
        // prepend args with the previous value
        args = [R.last(accum)].concat(args)

        assertIs.baseOperator(operator)
        const operatorName = baseOperatorInverseMap[operator.value]
        const newSet = {type: types.set, value: determineSet[operatorName](...args)}
        accum.push(newSet)
    }
    return R.merge(R.last(accum), {accum: R.init(accum)})
}

// functions to register and resolve from an env

const emptyEnv = {vars: {}, operators: {}}
/**
 * Given an resolve a variable in a given scope, else
 * return the object itself.
 *
 * TODO: resolve vars inside relation_literals.
 */
const resolve = (env, o)=>{
    if(!R.isNil(o.headers)) return o  // already been resolved
    if(is.var(o) || is.relation(o)) return env.vars[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.operator(o)) return env.operators[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.relation_literal(o)) return {type: types.relation, headers: o.value[0].value}
    if(is.all_headers(o)){
        const relation = {type: types.relation, value: R.init(o.value)}
        return {type: types.set, value: resolve(env, relation).headers}
    }
    if(is.set(o)) return {type: types.set, value: o.value.map(o=>resolve(env, o))}
    if(is.template(o)) return populateTemplate(env, o)
    return o
}
const addRegistration = (env, registration)=>{
    const type = Object.keys(registration)[0]
    const name = Object.keys(registration[type])[0]
    return R.assocPath([type, name], registration[type][name], env)
}
/**
 * Return a `registration` that can be deep merged with an
 * existing `env` to add a definition (of type def or let).
 */
const registerDefinition = (env, definition)=>{
    if(is.def(definition)){
        const [operator, ...args] = definition.value  // args here is [arg, arg ... section]
        const nestedOperator = R.merge(operator, {operator_section: args.pop(), args: args})
        return {operators: {[operator.value]: nestedOperator}}
    }
    // else is.let(definition)
    const [let_, section] = definition.value
    return {vars: {[let_.value]: compileHeaders(env, section)}}
}
/**
 * Return a `registration` that can be deep merged with an
 * existing `operatorEnv` (an `env` specifically for an operator)
 * to add an arg.
 */
const registerOperatorArg = (operatorArg, arg)=>{
    return {vars: {[operatorArg.value]: arg}}
}
let macroOperatorIndex = 0
/**
 * Create a `registration` as above for a macro that is
 * a composite operator containing the expanded macro lines.
 *
 * TODO: provide more specific error messages when the
 *   parser fails here.
 */
const expandAndRegisterMacro = (env, line)=>{
    const [headers, template] = line.value
    const set = assertIs.set(resolve(env, headers))
    const resolved = set.value
        .map(value=>resolve(R.merge(env, {vars: {_: value}}), template))
    const lines = resolved
        .map(fullParser)
        .map(asserters.assertMacroShape)
        .map(o=>o.value[0])  // o.type === section

    const operatorName = `macroOperator${macroOperatorIndex}`
    macroOperatorIndex += 1

    const operatorLine = {type: types.line, value: [{type: types.operator, value: operatorName}]}
    const registration = {operators: {[operatorName]: {
        type: types.operator,
        value: operatorName,
        args: [{type: types.relation, value: 'relation:'}],
        operator_section: {
            type: types.section,
            value: [
                {type: types.line, value: [{type: types.relation, value: 'relation:'}]}
            ].concat(lines)
        },
    }}}
    return {line: operatorLine, registration: registration}
}

/**
 * Populate a template with resolved vars.
 */
const populateTemplate = (env, o)=>{
    let out = ''
    let string = o.value.slice(1, -1)
    for(let match of string.match(/{{[a-zA-Z0-9\.\:_]+}}/g)){
        const varName = match.slice(2, -2)
        const index = string.search(match)
        out += string.slice(0, index)  // the head
        out += toString(resolve(env, {type: types.var, value: varName}))
        string = string.slice(index + match.length)  // the tail
    }
    return out + string
}

const compileHeaders = (env, section)=>{
    asserters.assertSectionShape(section)
    const defs = section.value.filter(is.letOrDef)
    const body = section.value.filter(R.complement(is.letOrDef))

    let envWithDefs = env
    for(let definition of defs){
        envWithDefs = addRegistration(envWithDefs, registerDefinition(envWithDefs, definition))
    }

    let [first, ...lines] = body
    if(is.singleRelationOrVarOrSet(first)) first = first.value[0]  // first.type == line

    if(is.relation(first) || is.relation_literal(first)){
        return doRelationHeaderOperations(envWithDefs, resolve(envWithDefs, first), lines)
    } else if(is.var(first) || is.set(first) || is.all_headers(first)){
        return doSetOperations(envWithDefs, resolve(envWithDefs, first), lines)
    } else if(is.aggregator(first)){
        return {aggregators: null, headers: body.map(o=>o.value[0])}
    }
}

const astToValue = {
    [types.bool]: node=>JSON.parse(node.value),
    [types.null]: node=>JSON.parse(node.value),
    [types.number]: node=>JSON.parse(node.value),
    [types.string]: node=>JSON.parse(node.value),
    [types.header]: node=>node.value,
    [types.relation]: node=>node.value,
    // TODO: implement these
    // [types.decimal]: node=>JSON.parse(node[types.decimal]),
    // [types.datetime]: node=>JSON.parse(node[types.datetime]),
}
const toString = o=>astToValue[o.type](o)

module.exports = {compileHeaders, emptyEnv}