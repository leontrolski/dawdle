const {types, getType, isMemberOf, is_} = require('./parser')
const {errors, asserters} = require('./errorsAndAsserters')

const R = require('ramda')


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
const symbolNameMap = R.invertObj(nameSymbolMap)

const determineHeaders = {
    filter: (rel, func, ...values)=>rel.headers,
    select: (rel, ...headers)=>headers,
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
// select - assert all headers are in rel.headers
// cross - assert no duplicate headers
// union, difference - assert headers are the same
// join - assert there is at least one common header
// group - assert none of the aggregator headers are in the headers


const isLetOrDef = o=>isMemberOf(o, [types.let, types.def])

// for literals
const astToRelation = relationLiteral=>{
    let [{headers}, ...rows] = relationLiteral
    rows = rows.map(row=>row[types.row])
    return {headers, rows}
}
const astToValue = {
    [types.bool]: node=>JSON.parse(node[types.bool]),
    [types.null]: node=>JSON.parse(node[types.null]),
    [types.number]: node=>JSON.parse(node[types.number]),
    [types.string]: node=>JSON.parse(node[types.string]),
    [types.header]: node=>node[types.header].slice(1),
    // this will require context to allow `var`s in table
    [types.relation_literal]: node=>astToRelation(node[types.relation_literal]),
    // requires context
    // [types.template]: node=>JSON.parse(node[types.template]),
    // TODO: implement these
    // [types.decimal]: node=>JSON.parse(node[types.decimal]),
    // [types.datetime]: node=>JSON.parse(node[types.datetime]),
}

const getHeadersFromRelation = o=>{
    if(isMemberOf(o, [types.relation_literal])){
        return astToValue[types.relation_literal](o).headers
    } else if(isMemberOf(o, [types.var])){
        throw new errors.NotImplemented('headers from var')
    } else {
        throw new errors.NoWayToReadHeadersFromNode(o)
    }
}

/**
 *
 * @param {*} env - [[key, value], ...]
 * @param {*} ast - {section: []}
 */
const compiler = (node, env)=>{
    env = env || []
    asserters.assertSectionShape(node)

    const defs = node[types.section].filter(isLetOrDef)
    for(let letOrDef of defs){
        if(isMemberOf(letOrDef, [types.def])){
            // do nothing yet
        }
        if(isMemberOf(letOrDef, [types.let])){
            const [varOrRelation, section] = letOrDef[types.let]
            env.push([varOrRelation, compiler(section)])
        }
    }
    console.log(env)


    const body = node[types.section].filter(R.complement(isLetOrDef))
    const [first, ...rest] = body
    // if(isMemberOf(first, [types.var])){



    const firstHeaders = getHeadersFromRelation(first)
    let bodyHeaders = [firstHeaders]
    for(let line of rest){  // and append potential next section to args
        if(!isMemberOf(line, [types.line])){
            throw new errors.NotImplemented('only dealing with lines currently')
        }
        const [operatorOrValue, ...args] = line[types.line]
        if(!isMemberOf(operatorOrValue, [types.operator])){
            throw new errors.NotImplemented('only dealing with operators currently')
        }
        let operator = operatorOrValue[types.operator]
        operator = symbolNameMap[operator] || operator

        if(!['select'].includes(operator)){
            throw new errors.NotImplemented('only dealing with select')
        }
        for(let arg of args){
            if(!isMemberOf(arg, [types.header])){
                throw new errors.NotImplemented('only dealing with header args currently')
            }
        }
        const newHeaders = determineHeaders[operator](
            {headers: R.last(bodyHeaders)}, ...args)

        bodyHeaders.push(newHeaders)
        // console.log(bodyHeaders)
    }
    return {bodyHeaders}
}

module.exports = {compiler}