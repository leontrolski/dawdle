const {types, is, assertIs, baseOperators, baseOperatorInverseMap} = require('./parser')
const {errors, asserters, log} = require('./errorsAndAsserters')

const R = require('ramda')

// TODO:
// - start work on def
// - finish up assertArgs
// - sort out [line, section] possibility
const determineHeaders = {
    // should all these lines be [baseOperators.filter]: ...
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

const mungeRelationLiteral = relationLiteral=>{
    let [headers, ..._] = relationLiteral[types.relation_literal]
    return R.merge(relationLiteral, headers)
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
    env = R.merge(env || {relations: {}, vars: {}, defs: {}}, {})  // clone as we mutate it later
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
        if(is.operator(o)) return env.defs[o[types.operator]] || (()=>{throw new errors.ScopeError(o)})()
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
        const set = first[types.line][0]
        return set
        // then do any other operations...
    } else if(is.relation_literal(first)){
        rel = mungeRelationLiteral(first)
    }
    const accum = [rel]
    for(let line of rest){  // and append potential next section to args

        if(!is.line(line)) continue  // TMP

        let [operator, ...args] = line[types.line]
        // resolve args and splat sets
        args = splatSets(args.map(resolve)).map(resolve)
        // resolve operator
        assertIs.operator(operator)
        operatorName = baseOperatorInverseMap[operator[types.operator]]
        operator = operatorName ? {[types.operator]: operatorName} : null // TMP resolve(operator)

        if(R.isNil(operator)) continue // TMP only works for select at the moment

        asserters.assertArgs[operator[types.operator]](R.last(accum), ...args)
        const newHeaders = determineHeaders[operator[types.operator]](R.last(accum), ...args)
        accum.push(R.merge(line, {headers: newHeaders}))
    }
    const out = {headers: R.last(accum).headers, accum: accum}
    log(out.accum.map(R.prop('headers')))
    log(out)
    return out
}

// functions for actual calculation
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

module.exports = {compiler}