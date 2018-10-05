import {
    Node, NodeMultiple, NodeSingle,
    Section, Let, Def, Line, Operator, Template, Value, Datetime, Decimal,
    fullParser, types, is, baseOperatorInverseMap, deMunge, NodeMinimal, inspect, baseOperators
} from './parser'
import * as operations from './operations'
import {errors, asserters, log} from './errorsAndAsserters'
import { RelationAPI } from './shared'

import * as R from 'ramda'
import { Map } from 'immutable'

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

// env is immutable as there is lots of copying and sharing
export type Env = Map<string, (Let | Def)>
export const emptyEnv: Env = Map({})

/**
 * Given an resolve a variable in a given scope, else
 * return the object itself.
 *
 * TODO: what does this really return?
 */
function resolveValue(env: Env, o: Node): any {
    if(is.var(o) || is.relation(o) || is.operator(o)){
        const resolved = env.get(o.value)
        if(R.isNil(resolved)) throw new errors.ScopeError(o, env)
        if(is.operator(o)){
            const [_, ...argsAndSection] = resolved.value
            const section = <Section>argsAndSection.pop()
            const args = argsAndSection
            return {args, section, env: resolved.env}
        }
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
    if(is.set(o)) return o.value.map(value=>resolveValue(env, value))
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
        const rowValues = rows.map(
            row=>asserters.assertRowLength(headerStrings, row.value)
                .map(value=>resolveValue(env, value))
                .map(toJSONValue)) // TODO: handle JSON+ types here
        return {
            headers: asserters.assertNoDuplicates(headerStrings),
            rows: asserters.assertNoDuplicates(rowValues),
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
function addRegistration(env: Env, registration: Registration): Env {
    const [first, ..._] = registration.value
    return env.merge({[first.value]: registration})
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
        .map(value=>env.merge({_: {type: types.let, value: [null, value]} as Let}))
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
        out += toJSONValue(resolveValue(env, {type: types.var, value: varName})).toString()
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
    if(is.aggregator(first)) return section

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
            // following line is pretty dutty, but we have to resolve the functions at some point
            if(operatorName === baseOperators.group) args.push(args.pop().value.map(o=>(o.value as any).map(n=>resolveValue(env, n))))
            asserters.assertArgs[compiledType][operatorName](...args)
            compiledValue = (operations as {[s: string]: any})[compiledType][operatorName](...args)
        } else {
            const op = resolveValue(env, operator)
            asserters.assertOperatorArgsMatch(op.args, args)
            // contruct env for operator, then compile its section with it
            let opEnv = op.env
            for(let [operatorArg, arg] of R.zip(op.args, args)){
                const registration = {
                    type: types.let,
                    value: [{value: (operatorArg as Node).value as string}, arg as Node]
                } as Let
                opEnv = addRegistration(opEnv, registration)
            }
            compiledValue = compiler(opEnv, op.section, justHeaders).compiledValue
        }
        withCompiled.push(R.merge(lineWithCompiledSection || line, {compiledType, compiledValue}))
    }
    return {type: types.section, value: withCompiled, compiledType, compiledValue}
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
export function toJSONValue(o: NodeSingle){
    return astToValue[o.type](o)
}
export function valueToNode(value: any): Node {
    if(value.type) return value as Node
    const type = {
        bool: types.bool,
        null: types.null,
        number: types.number,
        string: types.string,
    }[typeof value]
    if(!type) throw new Error(`Couldn't work out type for ${value}`)
    return {type: type, value: JSON.stringify(value)}
}

export function letsToEnv(env: Env, sectionAst: NodeMinimal): Env {
    const compiledSection = compiler(env, deMunge(sectionAst) as Section, false)
    const lets = compiledSection.value.filter(is.let)
    return R.mergeAll(lets.map(let_=>({[let_.value[0].value]: let_})))
}
export function compileAST(env: Env, ast: NodeMinimal): RelationAPI {
    return compiler(env, deMunge(ast) as Section, false).compiledValue
}