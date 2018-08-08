const {types, isMemberOf, is_} = require('./parser')

const util = require('util')
const R = require('ramda')
const inspect = o=>util.inspect(o, {depth: 4})

class SectionOrderIncorrect extends Error {constructor(node) {
    super(`The order of defs and lines in the section is incorrect: ${inspect(node)}`)
}}
class FirstNodeNotARelationOrSet extends Error {constructor(node) {
    super(`The first node of the body is not a relation or a set: ${inspect(node)}`)
}}
class NodeNotValidBodyType extends Error {constructor(node) {
    super(`The node is not a valid body type: ${inspect(node)}`)
}}
class NoWayToReadHeadersFromNode extends Error {constructor(node) {
    super(`There is no way to read headers from the node: ${inspect(node)}`)
}}
class NotImplemented extends Error {constructor(message) {
    super(message)
}}

const assertSectionShape = section=>{
    const defs = section[types.section].filter(is_.letOrDef)
    const body = section[types.section].filter(R.complement(is_.letOrDef))
    if(!R.equals(section, {[types.section]: [...defs, ...body]})){
        throw new SectionOrderIncorrect(section)
    }
    assertBodyShape(body)
}
const assertBodyShape = body=>{
    // matches form relation_literal | {line: [var | relation | set]}
    const isValidFirstValue = R.anyPass([is_.relationLiteral, is_.singleVar, is_.singleRelation, is_.singleSet]),
    const isValidBodyType = o=>isMemberOf(o, [types.line, types.map_macro, types.section])

    const [first, ...rest] = body
    if(!isRelationOrSet(first)) throw new FirstNodeNotARelationOrSet(first)
    for (let o of rest){
        if(!isValidBodyType(o)) throw new NodeNotValidBodyType(o)
    }
}

module.exports = {
    errors: {
        SectionOrderIncorrect,
        FirstNodeNotARelationOrSet,
        NodeNotValidBodyType,
        NoWayToReadHeadersFromNode,
        NotImplemented,
    },
    asserters: {
        assertSectionShape,
        assertBodyShape,
    }
}