const {fullParser, types, is, assertIs, baseOperatorInverseMap} = require('./parser')
const {determineHeaders, determineSet} = require('./operations')
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
        // TODO: mega hack alert
        else if(is.section(o)) {
            if(R.isNil(o.setValues)) listOut.push(o)
            else listOut = listOut.concat(o.setValues)
        }
        else listOut.push(o)
    }
    return listOut
}

// functions to register and resolve from an env
const emptyEnv = {lets: {}, defs: {}}
/**
 * Given an resolve a variable in a given scope, else
 * return the object itself.
 */
const resolveValue = (env, o)=>{
    if(is.var(o)) return env.lets[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.relation(o)) return env.lets[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.operator(o)) return env.defs[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.template(o)) return populateTemplate(env, o)
    return o
}
const getSetValues = (env, o)=>{
    if(!R.isNil(o.setValues)) return o.setValues  // already been resolved
    if(is.set(o)) return o.value
    if(is.all_headers(o)) return getHeaders(env, {type: types.relation, value: R.init(o.value)})
    throw new errors.ScopeError(o, env)
}
const getHeaders = (env, o)=>{
    if(!R.isNil(o.headers)) return o.headers  // already been resolved
    if(is.relation(o)) return resolveValue(env, o).headers
    if(is.relation_literal(o)) return o.value[0].value
    throw new errors.ScopeError(o, env)
}
const addRegistration = (env, registration)=>{
    const type = Object.keys(registration)[0]
    const name = Object.keys(registration[type])[0]
    return R.assocPath([type, name], registration[type][name], env)
}
/**
 * Create a `registration` as above for a macro that is
 * a composite operator containing the expanded macro lines.
 *
 * TODO: provide more specific error messages when the
 *   parser fails here.
 */
let macroOperatorIndex = 0  // global counter
const expandAndRegisterMacro = (env, line)=>{
    const [headers, template] = line.value
    const setValues = getSetValues(env, resolveValue(env, headers))
    const resolved = setValues
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
        section: {
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
    const withCompiled = []  // we will append to this

    for(let definition of defs){
        const [first, ...argsAndSection] = definition.value
        const section = argsAndSection.pop()
        const args = argsAndSection

        let def
        if(is.def(definition)){
            withCompiled.push(definition)
            const structured = R.merge(first, {section, args})
            def = {defs: {[first.value]: structured}}
        }
        else{  // is.let(definition)
            const compiled = compiler(env, section)
            withCompiled.push(compiled)
            def = {lets: {[first.value]: compiled}}
        }
        env = addRegistration(env, def)
    }

    const [firstLine, ...lines] = body
    const first = is.line(firstLine)? firstLine.value[0] : firstLine
    // handle aggregators
    if(is.aggregator(first)) return R.merge(firstLine, {headers: body.map(o=>o.value[0])})

    const isSet = is.var(first) || is.set(first) || is.all_headers(first)
    const valuesType = isSet? 'setValues' : 'headers'
    const resolve = isSet? getSetValues : getHeaders
    const operators = isSet? determineSet : determineHeaders
    let values

    values = resolve(env, first)
    withCompiled.push(R.merge(firstLine, {[valuesType]: values}))

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
        args = splatSets(args.map(o=>resolveValue(env, o))).map(o=>resolveValue(env, o))
        // prepend args with the previous value
        args = [{type: types.set, [valuesType]: values}].concat(args)
        // append final section to args if it exists
        if(!R.isNil(finalSection)) args.push(compiler(env, finalSection))

        if(is.baseOperator(operator)){
            const operatorName = baseOperatorInverseMap[operator.value]
            // TODO: make this work again
            // asserters.assertArgs[operatorName](...args)
            values = operators[operatorName](...args)
        } else {
            const operator_ = resolveValue(env, operator)
            // TODO: make this work again
            // asserters.assertOperatorArgsMatch(operator_.args, args)
            // contruct env for operator, then compile its section with it
            let operatorEnv = env
            for(let [operatorArg, arg] of R.zip(operator_.args, args)){
                const registration = {lets: {[operatorArg.value]: arg}}
                operatorEnv = addRegistration(operatorEnv, registration)
            }
            values = compiler(operatorEnv, operator_.section)[valuesType]
        }
        withCompiled.push(R.merge(line, {[valuesType]: values}))
    }
    const sectionWith = {type: types.section, value: withCompiled}
    return R.merge(sectionWith, {[valuesType]: values})
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
