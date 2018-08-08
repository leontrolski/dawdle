const {types, is, TypeError} = require('./parser')

const util = require('util')
const R = require('ramda')
const inspect = o=>util.inspect(o, {depth: 4})
const log = o=>console.log(inspect(o))

class ScopeError extends Error {constructor(node) {
    super(`Scope doesn't contain var or relation: ${inspect(node)}`)
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
class NotImplemented extends Error {constructor(message) {
    super(message)
}}

const assertSectionShape = section=>{
    const defs = section[types.section].filter(is.letOrDef)
    const body = section[types.section].filter(R.complement(is.letOrDef))
    if(!R.equals(section, {[types.section]: [...defs, ...body]})){
        throw new SectionOrderIncorrect(section)
    }
    assertBodyShape(body)
}
const assertBodyShape = body=>{
    // matches form relation_literal | {line: [var | relation | set]}
    const isValidFirstValue = R.anyPass([is.relation_literal, is.singleRelation, is.singleVar, is.singleSet])
    const isValidBodyType = R.anyPass([is.line, is.map_macro, is.section])

    const [first, ...rest] = body
    if(!isValidFirstValue(first)) throw new FirstNodeNotARelationOrSet(first)
    for (let o of rest){
        if(!isValidBodyType(o)) throw new NodeNotValidBodyType(o)
    }
}

module.exports = {
    errors: {
        TypeError,
        ScopeError,
        SectionOrderIncorrect,
        FirstNodeNotARelationOrSet,
        NodeNotValidBodyType,
        NotImplemented,
    },
    asserters: {
        assertSectionShape,
        assertBodyShape,
    },
    log,
}