const {types, is, assertIs, getType, inspect, ParserError, TypeError, UnableToDetermineTypeError} = require('./parser')

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
    if(R.isNil(section[types.section])) throw new ParserError()
    if(is.aggregator(section[types.section][0])){
        // if the first node is an aggregator, assert that the rest are
        section[types.section].forEach(assertIs.aggregator)
        return section
    }
    const defs = section[types.section].filter(is.letOrDef)
    const body = section[types.section].filter(R.complement(is.letOrDef))
    if(!R.equals(section[types.section], [...defs, ...body])) throw new SectionOrderIncorrect(section)
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
    if(section[types.section].length != 1) throw new MacroLineNotSingleLine(section)
    assertIs.operator(section[types.section][0][types.line][0])
    return section
}

const assertHasHeaders = rel=>{
    if(R.isNil(rel.headers)) throw new MissingHeaders(rel)
    rel.headers.forEach(o=>assertIs.header(o))
    return rel
}
const assertArgs = {
    filter: (rel, func, ...values)=>{
        assertHasHeaders(rel)
        assertIs.var(func)
    },
    select: (rel, ...headers)=>{
        assertHasHeaders(rel)
        if(!R.equals(R.intersection(rel.headers, headers), headers)) throw new SelectError(rel.headers, headers)
    },
    extend: (rel, header, func, ...values)=>{
        assertHasHeaders(rel)
        assertIs.header(header)
        assertIs.var(func)
    },
    cross: (rel, value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(!R.isEmpty(R.intersection(rel.headers, value.headers))) throw new CrossError(rel.headers, value.headers)
    },
    union: (rel, value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(!R.equals(rel.headers, value.headers)) throw new UnionOrDifferenceError(rel.headers, value.headers)
    },
    difference: (rel, value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(!R.equals(rel.headers, value.headers)) throw new UnionOrDifferenceError(rel.headers, value.headers)
    },
    join: (rel, value)=>{
        assertHasHeaders(rel)
        assertHasHeaders(value)
        if(R.isEmpty(R.intersection(rel.headers, value.headers))) throw new JoinError(rel.headers, value.headers)
    },
    group: (rel, ...headers_allAggregator)=>null, // assert none of the aggregator headers are in the headers
}
const assertOperatorArgsMatch = (operatorArgs, args)=>{
    if(!R.equals(operatorArgs.map(getType), args.map(getType))) throw new OperatorArgsError(operatorArgs, args)
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
        assertArgs,
        assertOperatorArgsMatch,
    },
    log,
}