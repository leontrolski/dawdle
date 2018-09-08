const {types, is, assertIs, inspect, ParserError, TypeError, UnableToDetermineTypeError} = require('./parser')

const R = require('ramda')
const log = o=>console.log(inspect(o))

class ScopeError extends Error {constructor(node, env) {
    super(`Scope doesn't contain var, relation or def: ${inspect(node)} \n in env: ${inspect(env)}`)
}}
class SectionOrderIncorrect extends Error {constructor(node) {
    super(`The order of defs and lines in the section is incorrect: ${inspect(node)}`)
}}
class FirstNodeNotARelationOrSet extends Error {constructor(node) {
    super(`The first node of the body is not a relation or a set: ${inspect(node)}`)
}}
class NodeNotValidBodyType extends Error {constructor(node) {
    super(`The node is not a valid body type: ${inspect(node)}`)
}}
class MacroLineNotSingleLine extends Error {constructor(node) {
    super(`The node is not a section with a single operator line: ${inspect(node)}`)
}}
class SelectError extends Error {constructor(fromHeaders, headers) {
    super(`Cannot select headers: ${inspect(headers)} \nfrom: ${inspect(fromHeaders)}`)
}}
class CrossError extends Error {constructor(fromHeaders, headers) {
    super(`Cannot cross product as there are overlapping headers between: ${inspect(fromHeaders)} \nand: ${inspect(headers)}`)
}}
class UnionOrDifferenceError extends Error {constructor(fromHeaders, headers) {
    super(`Cannot union or difference as there are differing headers between: ${inspect(fromHeaders)} \nand: ${inspect(headers)}`)
}}
class JoinError extends Error {constructor(fromHeaders, headers) {
    super(`Cannot join as there are no shared headers between: ${inspect(fromHeaders)} \nand: ${inspect(headers)}`)
}}
class MissingHeaders extends Error {constructor(node) {
    super(`Object has no headers: ${inspect(node)}`)
}}
class OperatorArgsError extends Error {constructor(operatorArgs, args) {
    super(`Provided args: ${inspect(args)} \ndo not match types of operator args: ${inspect(operatorArgs)}`)
}}
class NotImplemented extends Error {constructor(message) {
    super(message)
}}

const assertSectionShape = section=>{
    if(R.isNil(section.value)) throw new ParserError()
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
const assertBodyShape = body=>{
    // matches form relation_literal | {line: [var | relation | set]}
    const isValidFirstValue = R.anyPass([is.relation_literal, is.singleRelationOrVarOrSet])
    const isValidBodyType = R.anyPass([is.line, is.map_macro, is.section])

    const [first, ...rest] = body
    if(!isValidFirstValue(first)) throw new FirstNodeNotARelationOrSet(first)
    for (let o of rest){
        if(!isValidBodyType(o)) throw new NodeNotValidBodyType(o)
        if(is.line(o)) assertIs.operator(o[0])
    }
    return body
}

const assertMacroShape = section=>{
    assertIs.section(section)
    if(section.value.length != 1) throw new MacroLineNotSingleLine(section)
    assertIs.operator(section.value[0].value[0])
    return section
}

const assertHasHeaders = rel=>{
    if(!(rel.compiledType === types.headers) || !rel.compiledValue.length) throw new MissingHeaders(rel)
    rel.compiledValue.forEach(o=>assertIs.header(o))
    return rel
}
const assertHeadersArgs = {
    filter: (rel, func, ...values)=>{
        assertHasHeaders(rel)
        assertIs.var(func)
    },
    select: (rel, ...headers)=>{
        assertHasHeaders(rel)
        if(!R.equals(R.intersection(rel.compiledValue, headers), headers)) throw new SelectError(rel.compiledValue, headers)
    },
    extend: (rel, header, func, ...values)=>{
        assertHasHeaders(rel)
        assertIs.header(header)
        assertIs.var(func)
    },
    cross: (rel, value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(!R.isEmpty(R.intersection(rel.compiledValue, value.compiledValue))) throw new CrossError(rel.compiledValue, value.compiledValue)
    },
    union: (rel, value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(!R.equals(rel.compiledValue, value.compiledValue)) throw new UnionOrDifferenceError(rel.compiledValue, value.compiledValue)
    },
    difference: (rel, value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(!R.equals(rel.compiledValue, value.compiledValue)) throw new UnionOrDifferenceError(rel.compiledValue, value.compiledValue)
    },
    join: (rel, value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(R.isEmpty(R.intersection(rel.compiledValue, value.compiledValue))) throw new JoinError(rel.compiledValue, value.compiledValue)
    },
    group: (rel, ...headers_allAggregator)=>null, // assert none of the aggregator headers are in the headers
}
// TODO: fill these in
const assertSetArgs = {
    union: (rel, value)=>{},
    difference: (rel, value)=>{},
}
const assertOperatorArgsMatch = (operatorArgs, args)=>{
    if(operatorArgs.length !== args.length) throw new OperatorArgsError(operatorArgs, args)
    // TODO: do some type checking stuff as well
}

module.exports = {
    errors: {
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
    },
    asserters: {
        assertSectionShape,
        assertBodyShape,
        assertMacroShape,
        assertArgs: {
            [types.set]: assertSetArgs,
            [types.headers]: assertHeadersArgs,
        },
        assertOperatorArgsMatch,
    },
    log,
}