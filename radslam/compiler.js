const {parser, types, getType, is, assertIs, baseOperatorInverseMap} = require('./parser')
const {errors, asserters, log} = require('./errorsAndAsserters')

const R = require('ramda')

const unnamedRelation = {[types.relation]: null}

const splatSets = list=>{
    let listOut = []
    for(let o of list){
        if(is.set(o)) listOut = listOut.concat(o[types.set])
        else listOut.push(o)
    }
    return listOut
}

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
        return headers.concat(aggregators.headers)
    }
}
const determineSet = {
    union: (set, ...rest)=>R.union(set[types.set], rest),
    difference: (set, ...rest)=>R.difference(set[types.set], rest),
}

const doSetOperations = (env, firstSet, lines)=>{
    // return firstSet
    const accum = [firstSet]
    let nextLineIndex = 0
    for(let line of lines){
        nextLineIndex += 1
        if(is.section(line)) continue  // these are handled below
        // TODO: handle macros etc as with relations
        let [operator, ...args] = line[types.line]
        // resolve args and splat sets
        args = splatSets(args.map(o=>resolve(env, o))).map(o=>resolve(env, o))
        // prepend args with the previous value
        args = [R.last(accum)].concat(args)
        // TODO:
        // append next section to args if it exists
        // const nextSection = lines[nextLineIndex]
        // if(!R.isNil(nextSection) && is.section(nextSection)) args.push(compileHeaders(env, nextSection))
        assertIs.baseOperator(operator)
        const operatorName = baseOperatorInverseMap[operator[types.operator]]
        // TODO:
        // asserters.assertArgs[operatorName](...args)
        const newSet = {[types.set]: determineSet[operatorName](...args)}
        accum.push(newSet)
    }
    return R.merge(R.last(accum), {accum: R.init(accum)})
}

const doRelationOperations = (env, firstRelation, lines)=>{
    const accum = [firstRelation]
    let nextLineIndex = 0
    for(let line of lines){
        nextLineIndex += 1
        if(is.section(line)) continue  // these are handled below
        if(is.map_macro(line)){
            const expanded = expandAndRegisterMacro(env, line)
            line = expanded.line
            env = R.mergeDeepRight(env, expanded.registration)
        }
        let [operator, ...args] = line[types.line]
        // resolve args and splat sets
        args = splatSets(args.map(o=>resolve(env, o))).map(o=>resolve(env, o))
        // prepend args with the previous value
        args = [R.last(accum)].concat(args)
        // append next section to args if it exists
        const nextSection = lines[nextLineIndex]
        if(!R.isNil(nextSection) && is.section(nextSection)) args.push(compileHeaders(env, nextSection))

        let newHeaders
        if(is.baseOperator(operator)){
            const operatorName = baseOperatorInverseMap[operator[types.operator]]
            asserters.assertArgs[operatorName](...args)
            newHeaders = {headers: determineHeaders[operatorName](...args)}
        } else {
            const operator_ = resolve(env, operator)
            asserters.assertOperatorArgsMatch(operator_.args, args)
            // contruct env for operator, then compile its section with it
            let operatorEnv = env
            for(let [operatorArg, arg] of R.zip(operator_.args, args)){
                operatorEnv = R.mergeDeepRight(operatorEnv, registerOperatorArg(operatorArg, arg))
            }
            newHeaders = compileHeaders(operatorEnv, operator_.operator_section)
        }
        const newValue = R.merge(unnamedRelation, newHeaders)
        accum.push(newValue)
    }
    return R.merge(R.last(accum), {accum: R.init(accum)})
}

// functions to register and resolve from an env
const emptyEnv = {relations: {}, vars: {}, operators: {}}
const resolve = (env, o)=>{
    if(!R.isNil(o.headers)) return o  // already been resolved
    if(is.var(o)) return env.vars[o[types.var]] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.relation(o)) return env.relations[o[types.relation]] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.operator(o)) return env.operators[o[types.operator]] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.relation_literal(o)) return R.merge(unnamedRelation, {headers: o[types.relation_literal][0][types.rl_headers]})  // TODO: this should be able to work with a given env..?
    if(is.all_headers(o)){
        const relation = {[types.relation]: R.init(o[types.all_headers])}
        return {[types.set]: resolve(env, relation).headers}
    }
    if(is.set(o)) return {[types.set]: o[types.set].map(o=>resolve(env, o))}
    if(is.template(o)) return populateTemplate(env, o)
    return o
}
const registerDefinition = (env, definition)=>{
    if(is.def(definition)){
        const [operator, ...args] = definition[types.def]  // args here is [arg, arg ... section]
        const nestedOperator = R.merge(operator, {operator_section: args.pop(), args: args})
        return {operators: {[operator[types.operator]]: nestedOperator}}
    }
    // else is.let(definition)
    const [let_, section] = definition[types.let]
    if(is.var(let_)) return {vars: {[let_[types.var]]: compileHeaders(env, section)}}
    // else is.relation(let_)
    if(is.relation(let_)) return {relations: {[let_[types.relation]]: compileHeaders(env, section)}}
}
const registerOperatorArg = (operatorArg, arg)=>{
    if(is.var(operatorArg)) return {vars: {[operatorArg[types.var]]: arg}}
    // else is.relation(operatorArg)
    return {relations: {[operatorArg[types.relation]]: arg}}
}
let macroOperatorIndex = 0
const expandAndRegisterMacro = (env, line)=>{
    const [headers, template] = line[types.map_macro]
    const set = assertIs.set(resolve(env, headers))
    const resolved = set[types.set]
        .map(value=>resolve(R.merge(env, {vars: {_: value}}), template))
    const lines = resolved
        .map(parser)
        .map(asserters.assertMacroShape)
        .map(o=>o[types.section][0])

    const operatorName = `macroOperator${macroOperatorIndex}`
    macroOperatorIndex += 1

    const operatorLine = {[types.line]: [{[types.operator]: operatorName}]}
    const registration = {operators: {[operatorName]: {
        [types.operator]: operatorName,
        operator_section: {[types.section]: [{[types.line]:
            [{[types.relation]: 'relation:'}]}].concat(lines)},
        args: [{[types.relation]: 'relation:'}],
    }}}
    return {line: operatorLine, registration: registration}
}

const compileHeaders = (env, section)=>{
    asserters.assertSectionShape(section)
    const defs = section[types.section].filter(is.letOrDef)
    const body = section[types.section].filter(R.complement(is.letOrDef))

    let envWithDefs = env
    for(let definition of defs){
        envWithDefs = R.mergeDeepRight(envWithDefs, registerDefinition(envWithDefs, definition))
    }

    let [first, ...lines] = body
    if(is.singleRelationOrVarOrSet(first)) first = first[types.line][0]

    if(is.relation(first) || is.relation_literal(first)){
        return doRelationOperations(envWithDefs, resolve(envWithDefs, first), lines)
    } else if(is.var(first) || is.set(first) || is.all_headers(first)){
        return doSetOperations(envWithDefs, resolve(envWithDefs, first), lines)
        return first  // then do any set operations...  also, implement var beggining
    } else if(is.aggregator(first)){
        return {aggregators: null, headers: body.map(o=>o[types.aggregator][0])}
    }
}

const astToValue = {
    [types.bool]: node=>JSON.parse(node[types.bool]),
    [types.null]: node=>JSON.parse(node[types.null]),
    [types.number]: node=>JSON.parse(node[types.number]),
    [types.string]: node=>JSON.parse(node[types.string]),
    [types.header]: node=>node[types.header].slice(1),
    // requires context
    // [types.template]: node=>JSON.parse(node[types.template]),
    // TODO: implement these
    // [types.decimal]: node=>JSON.parse(node[types.decimal]),
    // [types.datetime]: node=>JSON.parse(node[types.datetime]),
}
const toString = o=>astToValue[getType(o)](o)
const populateTemplate = (env, o)=>{
    let out = ''
    let string = o[types.template].slice(1, -1)
    for(let match of string.match(/{{[a-zA-Z0-9\.\:_]+}}/g)){
        const varName = match.slice(2, -2)
        const index = string.search(match)
        out += string.slice(0, index)  // the head
        out += toString(env.vars[varName] || (()=>{throw new errors.ScopeError(match, env)})())
        string = string.slice(index + match.length)  // the tail
    }
    return out + string
}

module.exports = {compileHeaders, emptyEnv}