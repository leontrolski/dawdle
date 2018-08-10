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
const emptyEnv = {relations: {}, vars: {}, defs: {}, defArgs: {}}

const compiler = (section, env)=>{
    env = R.merge(env || emptyEnv, {})  // clone as we mutate it later
    asserters.assertSectionShape(section)

    const defs = section[types.section].filter(is.letOrDef)
    for(let letOrDef of defs){
        if(is.def(letOrDef)){
            const [operator, ...args] = letOrDef[types.def]
            const section = args.pop()
            env.defs[operator[types.operator]] = section
            env.defArgs[operator[types.operator]] = args
        }
        if(is.let(letOrDef)){
            const [v, section] = letOrDef[types.let]
            if(is.var(v)) env.vars[v[types.var]] = compiler(section)
            if(is.relation(v)) env.relations[v[types.relation]] = compiler(section)
        }
    }
    // log(env)/
    const resolve = o=>{
        if(is.var(o)) return env.vars[o[types.var]] || (()=>{throw new errors.ScopeError(o)})()
        if(is.relation(o)) return env.relations[o[types.relation]] || (()=>{throw new errors.ScopeError(o)})()
        if(is.operator(o)) return env.defs[o[types.operator]] || (()=>{throw new errors.ScopeError(o)})()
        return o
    }
    const resolveOperatorArgs = operator=> env.defArgs[operator[types.operator]]

    const body = section[types.section].filter(R.complement(is.letOrDef))
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
    let i = 0
    for(let line of rest){  // and append potential next section to args
        if(is.section(line)) continue  // these are handled below

        let [operator, ...args] = line[types.line]
        assertIs.operator(operator)
        args = splatSets(args.map(resolve)).map(resolve)  // resolve args and splat sets
        // add next section to args if it exists
        const nextLine = rest[i + 1]
        if(!R.isNil(nextLine) && is.section(nextLine)){
            args.push(compiler(nextLine))
        }

        let headerAsserter, headerDeterminer, operatorName
        if(operatorName = baseOperatorInverseMap[operator[types.operator]]){
            headerAsserter = asserters.assertArgs[operatorName]
            headerDeterminer = determineHeaders[operatorName]
        } else{
            const operatorSection = resolve(operator)
            // log(resolveOperatorArgs(operator))
            log({args})
            // compiler(operatorSection, env)
            headerAsserter = (..._)=>null
            headerDeterminer = (..._)=>null
        }

        headerAsserter(R.last(accum), ...args)
        const newHeaders = headerDeterminer(R.last(accum), ...args)
        accum.push(R.merge(line, {headers: newHeaders}))
        i += 1
    }
    const out = {headers: R.last(accum).headers, accum: accum}
    // log(out.accum.map(R.prop('headers')))
    // log(out)
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