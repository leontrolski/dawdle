import {
    Node, NodeMultiple, NodeSingle,
    Section, Let, Def, Line, Aggregator, MapMacro, NamedValue, RelationLiteral,
    RlHeaders, RlRow, Set, AllHeaders, Relation, Header, Var, Operator, Bool,
    Null, Number, String, Template, Decimal, Datetime, Function, Literal, Value,
    fullParser, types, is, baseOperatorInverseMap
} from './parser'
import * as operations from './operations'
import {errors, asserters, log} from './errorsAndAsserters'

import * as R from 'ramda'

/**
 * Given a list of values, return the list, but with the
 * sets splatted in place.
 *
 * eg:  a b [c d e] f -> a b c d e f
 */
function splatSets(list: Node[]){
    let listOut: Node[] = []
    for(let o of list){
        if(is.set(o)) listOut = listOut.concat(o.value)
        else if(o.compiledType === types.set) listOut = listOut.concat(o.compiledValue)
        else listOut.push(o)
    }
    return listOut
}

// functions to register and resolve from an env
export type Env = {lets: any, defs: any}
export const emptyEnv: Env = {lets: {}, defs: {}}
/**
 * Given an resolve a variable in a given scope, else
 * return the object itself.
 */
function resolveValue(env: Env, o: Node): any {
    if(is.var(o)) return env.lets[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.relation(o)) return env.lets[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.operator(o)) return env.defs[o.value] || (()=>{throw new errors.ScopeError(o, env)})()
    if(is.all_headers(o)) return {
        compiledType: types.set,
        compiledValue: getHeaders(env, {type: types.relation, value: R.init(o.value)})
    }
    if(is.template(o)) return populateTemplate(env, o)
    return o
}
function getSetValues(env: Env, o: Node): Node[] {
    if(o.compiledType === types.set) return o.compiledValue
    if(is.set(o)) return o.value
    if(is.all_headers(o)) return getHeaders(env, {type: types.relation, value: R.init(o.value)})
    throw new errors.ScopeError(o, env)
}
function getHeaders(env: Env, o: Node){
    if(o.compiledType === types.headers) return o.compiledValue
    if(is.relation(o)) return resolveValue(env, o).compiledValue
    if(is.relation_literal(o)) return o.value[0].value
    throw new errors.ScopeError(o, env)
}
const getValue = {
    [types.set]: getSetValues,
    [types.headers]: getHeaders,
}
type Registration = {[type_: string]: {[name: string]: Node}}  // TODO: sort out the mess of this with defs
function addRegistration(env: Env, registration: Registration){
    const type = Object.keys(registration)[0]
    const name = Object.keys(registration[type])[0]
    return R.assocPath([type, name], registration[type][name], env)
}
/**
 * Create a `registration` as above for a macro that is
 * a composite operator containing the expanded macro lines.
 */
let macroOperatorIndex = 0  // global counter
function expandAndRegisterMacro(env: Env, line: Line){
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
            value: ([
                {type: types.line, value: [{type: types.relation, value: 'relation:'}]}
            ] as Node[]).concat(lines)
        },
    }}}
    return {line: operatorLine, registration: registration}
}

/**
 * Populate a template with resolved vars.
 */
function populateTemplate(env: Env, o: Template): string{
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


export function compiler(env: Env, section: NodeMultiple): Node {
    asserters.assertSectionShape(section)
    const defs = section.value.filter(is.letOrDef) as Array<Let | Def>
    const body = section.value.filter(R.complement(is.letOrDef))
    const withCompiled = []  // we will append to this

    for(let definition of defs){
        const [first, ...argsAndSection] = definition.value
        const section = argsAndSection.pop() as NodeMultiple
        const args = argsAndSection

        let registration
        if(is.def(definition)){
            // TODO: would be nicer if this munging didn't happen here, but on retrieval
            const structured = R.merge(first, {section, args})
            registration = {defs: {[first.value]: structured}}
            withCompiled.push(definition)
        }
        else{  // is.let(definition)
            const compiledSection = compiler(env, section)
            registration = {lets: {[first.value]: compiledSection}}
            const letWithCompiledSection = R.assocPath(
                ['value', definition.value.length - 1], compiledSection, definition)
            withCompiled.push(letWithCompiledSection)
        }
        env = addRegistration(env, registration)
    }

    const [firstLine, ...lines] = body
    const first = is.line(firstLine)? firstLine.value[0] : firstLine

    // TODO: handle aggregators consistently with everything else
    if(is.aggregator(first)) return R.merge(
        firstLine, {compiledType: types.headers, compiledValue: body.map(o=>o.value[0])}) as Node
    const isSet = is.var(first) || is.set(first) || is.all_headers(first)
    const compiledType = isSet? types.set : types.headers
    let compiledValue

    compiledValue = getValue[compiledType](env, first)
    withCompiled.push(R.merge(firstLine, {compiledType, compiledValue}))

    for(let line of lines){
        // these two lets are a bit mucky
        let lineWithCompiledSection = null
        let macroLine = null
        let finalSection = null

        if(is.map_macro(line)){
            const expanded = expandAndRegisterMacro(env, line)
            macroLine = expanded.line
            env = addRegistration(env, expanded.registration)
        }

        let [operator, ...args] = (macroLine || line).value as [Operator, Value, Value]
        if(args.length > 0 && is.section(R.last(args) as Node)) finalSection = args.pop()

        // resolve args and splat sets
        args = splatSets(args.map(o=>resolveValue(env, o as Node))).map(o=>resolveValue(env, o))
        // prepend args with the previous value
        args = [{compiledType, compiledValue} as Node].concat(args as Node[])
        // append final section to args if it exists
        if(!R.isNil(finalSection)){
            const compiledSection = compiler(env, finalSection as Section)
            args.push(compiledSection)
            lineWithCompiledSection = R.assocPath(
                ['value', line.value.length - 1], compiledSection, line)
        }

        if(is.baseOperator(operator)){
            const operatorName = baseOperatorInverseMap[operator.value]
            asserters.assertArgs[compiledType][operatorName](...args)
            compiledValue = (operations as {[s: string]: any})[compiledType][operatorName](...args)
        } else {
            const operator_ = resolveValue(env, operator)
            asserters.assertOperatorArgsMatch(operator_.args, args)
            // contruct env for operator, then compile its section with it
            let operatorEnv = env
            for(let [operatorArg, arg] of R.zip(operator_.args, args)){
                const registration = {lets: {[(operatorArg as Node).value as any]: arg}}
                operatorEnv = addRegistration(operatorEnv, registration)
            }
            compiledValue = compiler(operatorEnv, operator_.section).compiledValue
        }
        withCompiled.push(R.merge(lineWithCompiledSection || line, {compiledType, compiledValue}))
    }
    const sectionWith = {type: types.section, value: withCompiled}
    return R.merge(sectionWith, {compiledType, compiledValue})
}

const astToValue: {[typeName: string]: (o: NodeSingle)=>string} = {
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
function toString(o: NodeSingle){
    return astToValue[o.type](o)
}
