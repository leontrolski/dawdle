import {
    Node, NodeMultiple, NodeSingle,
    Section, Let, Def, Line, Operator, Template, Value,
    fullParser, types, is, baseOperatorInverseMap, Datetime, Decimal
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
export type Env = {[key: string]: any} // TODO, change this to Let | Def}
export const emptyEnv: Env = {}
/**
 * Given an resolve a variable in a given scope, else
 * return the object itself.
 *
 * TODO: what does this really return?
 */
function resolveValue(env: Env, o: Node): any {
    if(is.var(o) || is.relation(o) || is.operator(o)){
        const resolved = env[o.value]
        if(R.isNil(resolved)) throw new errors.ScopeError(o, env)
        if(is.operator(o)) return resolved
        const [_, section] = resolved.value
        return section
    }
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
    // if(is.var(o)) return resolveValue(env, o)  // TODO: is this cool?
    throw new errors.ScopeError(o, env)
}
function getHeaders(env: Env, o: Node){
    if(o.compiledType === types.headers) return o.compiledValue
    if(is.relation(o)) return resolveValue(env, o).compiledValue
    if(is.relation_literal(o)) return o.value[0].value
    throw new errors.ScopeError(o, env)
}
function getRelation(env: Env, o: Node){ // TODO: :RelationAPI {
    if(o.compiledType === types.relation) return o.compiledValue
    if(is.relation(o)) return resolveValue(env, o).compiledValue
    if(is.relation_literal(o)){
        const [headers, ...rows] = o.value as Array<NodeMultiple>
        const headerStrings = headers.value.map(o=>(o.value as string).slice(1))
        const rowValues = rows.map(row=>row.value.map(toString)) // TODO: handle JSON+ types here
        return {
            headers: headerStrings,
            rows: rowValues,
        }
    }
    throw new errors.ScopeError(o, env)
}
const getValue = {
    [types.set]: getSetValues,
    [types.headers]: getHeaders,
    [types.relation]: getRelation,
}
type Registration = Let | Def
function addRegistration(env: Env, registration: Registration){
    const [first, ..._] = registration.value
    if(is.let(registration))return R.assocPath([first.value], registration, env)
    if(is.def(registration))return R.assocPath([first.value], registration, env)
}
/**
 * Create a `registration`as above for a macro that is
 * a composite operator containing the expanded macro lines.
 */
let macroOperatorIndex = 0  // global counter
function expandAndRegisterMacro(env: Env, line: Line){
    const [headers, template] = line.value
    const setValues = getSetValues(env, resolveValue(env, headers))
    const resolved = setValues
        .map(value=>R.merge(env, {_: {value: [null, value]}}))
        .map(envWithValue=>resolveValue(envWithValue, template))
    const lines = resolved
        .map(fullParser)
        .map(asserters.assertMacroShape)
        .map(o=>o.value[0])  // o.type === section

    const operatorName = `macroOperator${macroOperatorIndex}`
    macroOperatorIndex += 1

    const operatorLine = {type: types.line, value: [{type: types.operator, value: operatorName}]}
    const section = ([{type: types.line, value: [{type: types.relation, value: 'relation:'}]} as Node]).concat(lines)
    const registration = {
        type: types.def,
        value:[
            {type: types.operator, value: operatorName},
            {type: types.relation, value: 'relation:'},
            {type: types.section, value: section},
        ],
        env: env,
    } as Def
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

export function compiler(env: Env, section: Section, justHeaders=true): Section {
    asserters.assertSectionShape(section)
    const defs = <(Let | Def)[]>section.value.filter(is.letOrDef)
    const body = <Line[]>section.value.filter(R.complement(is.letOrDef))
    const withCompiled = []  // we will append to this

    for(let definition of defs){
        let registration
        if(is.def(definition)){
            withCompiled.push(definition)
            registration = {env, ...definition}
        }
        else{  // is.let(definition)
            const [first, section] = definition.value
            const letWithCompiledSection = {
                type: types.let,
                value: [first, compiler(env, section, justHeaders)]
            }
            withCompiled.push(letWithCompiledSection)
            registration = letWithCompiledSection
        }
        env = addRegistration(env, registration)
    }

    const [firstLine, ...lines] = body
    const first = is.line(firstLine)? firstLine.value[0] : firstLine

    // TODO: handle aggregators consistently with everything else
    if(is.aggregator(first)) return {
        type: types.section,
        value: body,
        compiledType: types.headers,
        compiledValue: body.map(o=>o.value[0]),
    }

    const isSet = is.var(first) || is.set(first) || is.all_headers(first)
    const compiledType = isSet? types.set : justHeaders? types.headers : types.relation
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

        let [operator, ...args] = (macroLine || line).value
        if(args.length > 0 && is.section(R.last(args))) finalSection = <Section>args.pop()

        // resolve args and splat sets
        args = splatSets(args.map(o=>resolveValue(env, o))).map(o=>resolveValue(env, o))
        // prepend args with the previous value
        args = [{compiledType, compiledValue} as Node].concat(args)
        // append final section to args if it exists
        if(!R.isNil(finalSection)){
            const compiledSection = compiler(env, finalSection, justHeaders)
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
            const [_, ...opArgsAndSection] = operator_.value
            const opSection = <Section>opArgsAndSection.pop()
            const opArgs = opArgsAndSection
            asserters.assertOperatorArgsMatch(opArgs, args)
            // contruct env for operator, then compile its section with it
            let opEnv = operator_.env
            for(let [operatorArg, arg] of R.zip(opArgs, args)){
                const registration = {
                    type: types.let,
                    value: [{value: (operatorArg as Node).value as string}, arg as Node]
                } as Let
                opEnv = addRegistration(opEnv, registration)
            }
            compiledValue = compiler(opEnv, opSection, justHeaders).compiledValue
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
    [types.decimal]: node=>node,
    [types.datetime]: node=>node,
    // TODO: what is the actual expected usage here? above assumes it is mapping to RelationAPI and back
    [types.header]: node=>node.value,
    [types.relation]: node=>node.value,

}
// TODO: see above comment
function toString(o: NodeSingle){
    return astToValue[o.type](o)
}
