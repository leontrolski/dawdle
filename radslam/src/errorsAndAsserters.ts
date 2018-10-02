import {
    Node, NodeSingle, Header, Line, Section, Relation, Value, Function,
    types, is, assertIs, inspect, ParserError, TypeError,
    UnableToDetermineTypeError,

} from './parser'
import { Env } from './compiler'

import * as R from 'ramda'
export const log = (o: any)=>console.log(inspect(o))

class ScopeError extends Error {constructor(node: Node, env: Env) {
    super(`Scope doesn't contain var, relation or def: ${inspect(node)} \nin: ${inspect([...env.keys()])}`)
}}
class SectionOrderIncorrect extends Error {constructor(node: Node) {
    super(`The order of defs and lines in the section is incorrect: ${inspect(node)}`)
}}
class FirstNodeNotARelationOrSet extends Error {constructor(node: Node) {
    super(`The first node of the body is not a relation or a set: ${inspect(node)}`)
}}
class NodeNotValidBodyType extends Error {constructor(node: Node) {
    super(`The node is not a valid body type: ${inspect(node)}`)
}}
class MacroLineNotSingleLine extends Error {constructor(node: Node) {
    super(`The node is not a section with a single operator line: ${inspect(node)}`)
}}
class SelectError extends Error {constructor(fromHeaders: Header[], headers: Header[]) {
    super(`Cannot select headers: ${inspect(headers)} \nfrom: ${inspect(fromHeaders)}`)
}}
class CrossError extends Error {constructor(fromHeaders: Header[], headers: Header[]) {
    super(`Cannot cross product as there are overlapping headers between: ${inspect(fromHeaders)} \nand: ${inspect(headers)}`)
}}
class UnionOrDifferenceError extends Error {constructor(fromHeaders: Header[], headers: Header[]) {
    super(`Cannot union or difference as there are differing headers between: ${inspect(fromHeaders)} \nand: ${inspect(headers)}`)
}}
class JoinError extends Error {constructor(fromHeaders: Header[], headers: Header[]) {
    super(`Cannot join as there are no shared headers between: ${inspect(fromHeaders)} \nand: ${inspect(headers)}`)
}}
class MissingHeaders extends Error {constructor(node: Node) {
    super(`Object has no headers: ${inspect(node)}`)
}}
class OperatorArgsError extends Error {constructor(operatorArgs: any[], args: any[]) {
    super(`Provided args: ${inspect(args)} \ndo not match types of operator args: ${inspect(operatorArgs)}`)
}}
class NotImplemented extends Error {constructor(message: string) {
    super(message)
}}

function assertSectionShape(section: Section){
    if(R.isNil(section.value)) throw new ParserError('section has no value', [])
    if(is.aggregator(section.value[0])){
        // if the first node is an aggregator, assert that the rest are
        section.value.forEach(assertIs.aggregator)
        return section
    }
    const defs = section.value.filter(is.letOrDef)
    const body = section.value.filter(R.complement(is.letOrDef))
    if(!R.equals(section.value, [...defs, ...body])) throw new SectionOrderIncorrect(section)
    assertBodyShape(body)
    return section
}
function assertBodyShape(body: Node[]){
    // matches form relation_literal | {line: [var | relation | set]}
    const isValidFirstValue = R.anyPass([is.relation_literal, is.singleRelationOrVarOrSet])
    const isValidBodyType = R.anyPass([is.line, is.map_macro, is.section])

    const [first, ...rest] = body
    if(!isValidFirstValue(first)) throw new FirstNodeNotARelationOrSet(first)
    for (let o of rest){
        if(!isValidBodyType(o)) throw new NodeNotValidBodyType(o)
        if(is.line(o)) assertIs.operator(o.value[0])
    }
    return body
}

function assertMacroShape(section: Section){
    assertIs.section(section)
    if(section.value.length != 1) throw new MacroLineNotSingleLine(section)
    assertIs.operator((section.value[0] as Line).value[0])
    return section
}

function assertHasHeaders(rel: Node){
    if(!(rel.compiledType === types.headers) || !rel.compiledValue.length) throw new MissingHeaders(rel)
    rel.compiledValue.forEach((o: Node)=>assertIs.header(o))
    return rel
}
const assertHeadersArgs = {
    filter: (rel: Relation, func: Function, ...values: Value[])=>{
        assertHasHeaders(rel)
        assertIs.var(func)
    },
    select: (rel: Relation, ...headers: Header[])=>{
        assertHasHeaders(rel)
        if(!R.equals(R.intersection(rel.compiledValue, headers), headers)) throw new SelectError(rel.compiledValue, headers)
    },
    extend: (rel: Relation, header: Header, func: Function, ...values: Value[])=>{
        assertHasHeaders(rel)
        assertIs.header(header)
        assertIs.var(func)
    },
    cross: (rel: Relation, value: Value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(!R.isEmpty(R.intersection(rel.compiledValue, value.compiledValue))) throw new CrossError(rel.compiledValue, value.compiledValue)
    },
    union: (rel: Relation, value: Value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(!R.equals(rel.compiledValue, value.compiledValue)) throw new UnionOrDifferenceError(rel.compiledValue, value.compiledValue)
    },
    difference: (rel: Relation, value: Value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(!R.equals(rel.compiledValue, value.compiledValue)) throw new UnionOrDifferenceError(rel.compiledValue, value.compiledValue)
    },
    join: (rel: Relation, value: Value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(R.isEmpty(R.intersection(rel.compiledValue, value.compiledValue))) throw new JoinError(rel.compiledValue, value.compiledValue)
    },
    group: (rel: Relation, ...headers_allAggregator: (Header | Section)[]): void=>null, // assert none of the aggregator headers are in the headers
}
// TODO: fill these in
const assertSetArgs = {
    union: (rel: Relation, value: Value)=>{},
    difference: (rel: Relation, value: Value)=>{},
}
// TODO: fill these in
const assertRelationArgs = {
    filter: (rel: Relation, func: Function, ...values: Value[])=>{},
    select: (rel: Relation, ...headers: Header[])=>{},
    extend: (rel: Relation, header: Header, func: Function, ...values: Value[])=>{},
    cross: (rel: Relation, value: Value)=>{},
    union: (rel: Relation, value: Value)=>{},
    difference: (rel: Relation, value: Value)=>{},
    join: (rel: Relation, value: Value)=>{},
    group: (rel: Relation, ...headers_allAggregator: (Header | Section)[])=>{},
}
const assertOperatorArgsMatch = (operatorArgs: any, args: any)=>{
    if(operatorArgs.length !== args.length) throw new OperatorArgsError(operatorArgs, args)
    // TODO: do some type checking stuff as well
}

export const errors = {
    TypeError,
    UnableToDetermineTypeError,
    ScopeError,
    SectionOrderIncorrect,
    FirstNodeNotARelationOrSet,
    NodeNotValidBodyType,
    SelectError,
    CrossError,
    UnionOrDifferenceError,
    JoinError,
    MissingHeaders,
    OperatorArgsError,
    NotImplemented,
}
const assertArgs: {[t: string]: {[_: string]: (...__: any[])=>void}} = {
    [types.set]: assertSetArgs,
    [types.headers]: assertHeadersArgs,
    [types.relation]: assertRelationArgs,
}
export const asserters = {
    assertSectionShape,
    assertBodyShape,
    assertMacroShape,
    assertArgs,
    assertOperatorArgsMatch,
}