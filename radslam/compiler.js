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
        // TODO: is the `is.section` a mega hack?
        if(is.set(o) || is.section(o)) listOut = listOut.concat(o.setValues)
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
    union: (set, ...rest)=>R.union(set.setValues, rest),
    difference: (set, ...rest)=>R.difference(set.setValues, rest),
}

// functions to register and resolve from an env

const emptyEnv = {lets: {}, defs: {}}
/**
 * Given an resolve a variable in a given scope, else
 * return the object itself.
 *
 * TODO: make reolving stuff more consistent.
 */
const resolveValue = (env, o)=>{
    if(is.operator(o)) return env.defs[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.template(o)) return populateTemplate(env, o)
    if(is.var(o)) return env.lets[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    return o
}
const resolveSet = (env, o)=>{
    if(is.set(o)) return R.merge(o, {setValues: o.value})
    if(is.var(o)) return env.lets[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.all_headers(o)){
        const relation = {type: types.relation, value: R.init(o.value)}
        return {type: types.set, setValues: resolveHeaders(env, relation)}
    }
    throw new errors.ScopeError(o, env)
}
const resolveHeaders = (env, o)=>{
    if(!R.isNil(o.headers)) return o.headers  // already been resolved
    if(is.relation(o)) return env.lets[o.value].headers || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.relation_literal(o)) return o.value[0].value
    throw new errors.ScopeError(o, env)
}

const addRegistration = (env, registration)=>{
    const type = Object.keys(registration)[0]
    const name = Object.keys(registration[type])[0]
    return R.assocPath([type, name], registration[type][name], env)
}

/**
 * Return a `registration` that can be deep merged with an
 * existing `operatorEnv` (an `env` specifically for an operator)
 * to add an arg.
 */
const registerOperatorArg = (operatorArg, arg)=>{
    return {lets: {[operatorArg.value]: arg}}
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
    const set = assertIs.set(resolveSet(env, headers))
    const resolved = set.setValues
        .map(value=>R.merge(env, {lets: {_: value}}))
        .map(envWithValue=>resolveValue(envWithValue, template))
    const lines = resolved
        .map(fullParser)
        .map(asserters.assertMacroShape)
        .map(o=>o.value[0])  // o.type === section

    const operatorName = `macroOperator${macroOperatorIndex}`
    macroOperatorIndex += 1

    const operatorLine = {type: types.line, value: [{type: types.operator, value: operatorName}]}
    const registration = {defs: {[operatorName]: {
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
        out += toString(resolveValue(env, {type: types.var, value: varName}))
        string = string.slice(index + match.length)  // the tail
    }
    return out + string
}

const compiler = (env, section)=>{
    asserters.assertSectionShape(section)
    const defs = section.value.filter(is.letOrDef)
    const body = section.value.filter(R.complement(is.letOrDef))

    const defsWith = []
    for(let definition of defs){
        const [first, ...argsAndSection] = definition.value
        const section = argsAndSection.pop()
        const args = argsAndSection

        let info, def
        if(is.def(definition)){
            info = {args, section}
            defsWith.push(definition)
            // old bit
            info = R.merge(first, {operator_section: info.section, args: info.args})
            def = {defs: {[first.value]: info}}
        }
        else{  // is.let(definition)
            info = compiler(env, section)
            defsWith.push(info)
            // old bit
            def = {lets: {[first.value]: info}}
        }
        env = addRegistration(env, def)
    }
    const [firstLine, ...lines] = body
    const first = is.line(firstLine)? firstLine.value[0] : firstLine
    // handle aggregators
    if(is.aggregator(first)) return R.merge(line, {headers: body.map(o=>o.value[0])})

    const isSet = is.var(first) || is.set(first) || is.all_headers(first)
    let setValues
    let headers

    if(isSet) setValues = resolveSet(env, first).setValues
    else headers = resolveHeaders(env, first)

    const linesWith = [R.merge(firstLine, isSet? {setValues} : {headers})]

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
        const resolveAll = o=>{
            if(is.relation(o)) return {headers: resolveHeaders(env, o)}
            if(is.set(o) || is.var(o) || is.all_headers(o)) return resolveSet(env, o)
            return resolveValue(env, o)
        }
        args = splatSets(args.map(resolveAll)).map(resolveAll)


        // prepend args with the previous value
        if(isSet) args = [{type: types.set, setValues: setValues}].concat(args)
        else args = [{type: types.relation, headers: headers}].concat(args)
        // append final section to args if it exists
        if(!R.isNil(finalSection)) args.push(compiler(env, finalSection))


        if(isSet){
            assertIs.baseOperator(operator)
            const operatorName = baseOperatorInverseMap[operator.value]
            setValues = determineSet[operatorName](...args)
        } else {
            if(is.baseOperator(operator)){
                const operatorName = baseOperatorInverseMap[operator.value]
                asserters.assertArgs[operatorName](...args)
                headers = determineHeaders[operatorName](...args)
            } else {
                const operator_ = resolveValue(env, operator)
                // TODO: make this work again
                // asserters.assertOperatorArgsMatch(operator_.args, args)
                // contruct env for operator, then compile its section with it
                let operatorEnv = env
                for(let [operatorArg, arg] of R.zip(operator_.args, args)){
                    operatorEnv = addRegistration(operatorEnv, registerOperatorArg(operatorArg, arg))
                }
                headers = compiler(operatorEnv, operator_.operator_section).headers
            }
        }
        linesWith.push(R.merge(line, isSet? {setValues} : {headers}))
    }
    const sectionWith = {type: types.section, value: defsWith.concat(linesWith)}
    return R.merge(sectionWith, isSet? {setValues} : {headers})
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

module.exports = {compiler, emptyEnv}