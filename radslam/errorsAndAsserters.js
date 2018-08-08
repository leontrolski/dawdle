const {types, isMemberOf} = require('./parser')

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

const isLetOrDef = o=>isMemberOf(o, [types.let, types.def])

const assertSectionShape = section=>{
    const defs = section[types.section].filter(isLetOrDef)
    const body = section[types.section].filter(R.complement(isLetOrDef))
    if(!R.equals(section, {[types.section]: [...defs, ...body]})){
        throw new SectionOrderIncorrect(section)
    }
    assertBodyShape(body)
}
const assertBodyShape = body=>{
    const isRelationOrSet = o=>
        isMemberOf(o, [types.relation_literal]) ||
        // matches form {line: [{set: }]}
        (isMemberOf(o, [types.line]) && o[types.line].length === 1 && isMemberOf(o[types.line][0], [types.set]))
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