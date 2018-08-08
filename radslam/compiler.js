const {types, is, assertIs} = require('./parser')
const {errors, asserters, log} = require('./errorsAndAsserters')

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

// for literals
const mungeRelationLiteral = relationLiteral=>{
    let [{headers}, ...rows] = relationLiteral[types.relation_literal]
    rows = rows.map(row=>row[types.row])
    return {headers, rows}
}

const astToValue = {
    [types.bool]: node=>JSON.parse(node[types.bool]),
    [types.null]: node=>JSON.parse(node[types.null]),
    [types.number]: node=>JSON.parse(node[types.number]),
    [types.string]: node=>JSON.parse(node[types.string]),
    [types.header]: node=>node[types.header].slice(1),
    // requires context
    // [types.template]: node=>JSON.parse(node[types.template]),
    // TODO: implement these
    // [types.decimal]: node=>JSON.parse(node[types.decimal]),
    // [types.datetime]: node=>JSON.parse(node[types.datetime]),
}


const splatSets = list=>{
    let listOut = []
    for(let o of list){
        if(is.set(o)) listOut = listOut.concat(o[types.set])
        else listOut.push(o)
    }
    return listOut
}

const compiler = (node, env)=>{
    env = env || {relations: {}, vars: {}}
    asserters.assertSectionShape(node)

    const defs = node[types.section].filter(is.letOrDef)
    for(let letOrDef of defs){
        if(is.def(letOrDef)){
            // do nothing yet
        }
        if(is.let(letOrDef)){
            const [varOrRelation, section] = letOrDef[types.let]
            if(is.var(varOrRelation)) env.vars[varOrRelation[types.var]] = compiler(section)
            if(is.relation(varOrRelation)) env.relations[varOrRelation[types.relation]] = compiler(section)
        }
    }
    const resolve = o=>{
        if(is.var(o)) return env.vars[o[types.var]] || (()=>{throw new errors.ScopeError(o)})()
        if(is.relation(o)) return env.relations[o[types.relation]] || (()=>{throw new errors.ScopeError(o)})()
        return o
    }

    const body = node[types.section].filter(R.complement(is.letOrDef))
    const [first, ...rest] = body

    let firstHeaders = []
    if(is.singleRelation(first)){
        throw 'waaa'
        return 'singleRelation'
    } else if (is.singleVar(first)){
        throw 'waaa2'
        return 'singleVar'
    } else if (is.singleSet(first)){
        firstHeaders = first[types.line][0]
        return firstHeaders
        // then do any other operations...
    } else if(is.relation_literal(first)){
        firstHeaders = mungeRelationLiteral(first).headers
    }
    let bodyHeaders = [firstHeaders]
    for(let line of rest){  // and append potential next section to args
        if(!is.line(line)){
            throw new errors.NotImplemented('only dealing with lines currently')
        }
        const [operatorOrValue, ...args] = line[types.line]
        if(!is.operator(operatorOrValue)){
            throw new errors.NotImplemented('only dealing with operators currently')
        }
        let operator = operatorOrValue[types.operator]
        operator = symbolNameMap[operator] || operator

        if(!['select'].includes(operator)){
            throw new errors.NotImplemented('only dealing with select')
        }
        const newHeaders = determineHeaders[operator](
            {headers: R.last(bodyHeaders)},
            ...splatSets(args.map(resolve)).map(R.pipe(resolve, assertIs.header))
        )
        bodyHeaders.push(newHeaders)
        log(bodyHeaders)
    }
    log(bodyHeaders)
    return {headers: bodyHeaders.slice(-1), all: bodyHeaders}

}

module.exports = {compiler}