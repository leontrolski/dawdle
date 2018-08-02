const {types} = require('./parser')

const R = require('ramda')

const getType = o=>Object.keys(o)[0]

const nameSymbolMap = {
    filter: '>',
    select: 'v',
    extend: '^',
    cross: 'X',
    union: 'U',
    difference: '-',
    join: 'J',
    group: 'G',
}

const determineHeaders = {
    filter: (rel, func, ...values)=>rel.headers,
    select: (rel, ...headers)=>R.difference(rel.headers, headers),
    extend: (rel, header, func, ...values)=>R.union(rel.headers, [header]),
    cross: (rel, value)=>rel.headers.concat(value.headers),
    union: (rel, value)=>rel.headers,
    difference: (rel, value)=>rel.headers,
    join: (rel, value)=>R.union(rel.headers, value.headers),
    group: (rel, ...headers_allAggregator)=>{
        const [allAggregator, ...headers] = headers_allAggregator.reverse()
        return headers.concat(allAggregator.headers)
    }
}
// all - assert all headers are of type header
// cross - assert no duplicate headers
// union, difference - assert headers are the same
// join - assert there is at least one common header
// group - assert none of the aggregator headers are in the headers


const compiler = (env, ast)=>{
    const topLevel = ast.section
    const processBlock = (block, parentScope)=>{

    }
    const letsAndDefs = topLevel.filter(
        o=>[types.let, types.def].includes(getType(o)))
    const rest = topLevel.filter(
        o=>[types.line, types.map_macro, types.relation_literal, types.section].includes(getType(o)))
    return [letsAndDefs, topLevel]
}

module.exports = {compiler}