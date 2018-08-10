const {types, is, assertIs, baseOperators, baseOperatorInverseMap} = require('./parser')
const {errors, asserters, log} = require('./errorsAndAsserters')

const R = require('ramda')

// TODO:
// - finish up assertArgs
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


const splatSets = list=>{
    let listOut = []
    for(let o of list){
        if(is.set(o)) listOut = listOut.concat(o[types.set])
        else listOut.push(o)
    }
    return listOut
}
const unnamedRelation = {[types.relation]: null}
const emptyEnv = {relations: {}, vars: {}, operators: {}}

const doRelationOperations = (rel, rest, env)=>{
    const accum = [rel]
    let i = 0
    for(let line of rest){  // and append potential next section to args
        if(is.section(line)) continue  // these are handled below
        const prevValue = R.last(accum)

        let [operator, ...args] = line[types.line]
        assertIs.operator(operator)
        // resolve args and splat sets
        args = splatSets(args.map(resolve)).map(resolve)
        // prepend args with the previous value
        args = [prevValue].concat(args)
        // add next section to args if it exists
        const nextLine = rest[i + 1]
        if(!R.isNil(nextLine) && is.section(nextLine)){
            args.push(compiler(nextLine))
        }

        let newHeaders, operatorName
        if(operatorName = baseOperatorInverseMap[operator[types.operator]]){
            asserters.assertArgs[operatorName](...args)
            newHeaders = {headers: determineHeaders[operatorName](...args)}
        } else{
            const operatorSection = resolve(operator)
            asserters.assertOperatorArgsMatch(operatorSection.args, args)
            operatorEnv = R.clone(env)
            for(let [operatorArg, arg] of R.zip(operatorSection.args, args)){
                if(is.var(operatorArg)) operatorEnv.vars[operatorArg[types.var]] = arg
                if(is.relation(operatorArg)) operatorEnv.relations[operatorArg[types.relation]] = arg
            }
            newHeaders = compiler(operatorSection, operatorEnv)
        }
        const newValue = R.merge(unnamedRelation, newHeaders)
        accum.push(newValue)
        i += 1
    }
    const out = R.merge(R.last(accum), {}) // , {accum: accum})
    // log(out.accum.map(R.prop('headers')))
    log(out)
    return out
}

const compiler = (section, env)=>{
    env = R.clone(env || emptyEnv)  // clone as we mutate it later
    asserters.assertSectionShape(section)

    const defs = section[types.section].filter(is.letOrDef)
    for(let letOrDef of defs){
        if(is.def(letOrDef)){
            const [operator, ...args] = letOrDef[types.def]
            const section = args.pop()
            env.operators[operator[types.operator]] = R.merge(section, {args})
        }
        if(is.let(letOrDef)){
            const [v, section] = letOrDef[types.let]
            if(is.var(v)) env.vars[v[types.var]] = compiler(section)
            if(is.relation(v)) env.relations[v[types.relation]] = compiler(section)
        }
    }
    const resolve = o=>{
        if(!R.isNil(o.headers)) return o  // already been resolved, this shouldn't really be here
        if(is.var(o)) return env.vars[o[types.var]] || (()=>{throw new errors.ScopeError(o, env)})()
        if(is.relation(o)) return env.relations[o[types.relation]] || (()=>{throw new errors.ScopeError(o, env)})()
        if(is.operator(o)) return env.operators[o[types.operator]] || (()=>{throw new errors.ScopeError(o, env)})()
        if(is.relation_literal(o)) return R.merge(unnamedRelation, {headers: o[types.relation_literal][0][types.rl_headers]})
        return o
    }

    const body = section[types.section].filter(R.complement(is.letOrDef))
    const [first, ...rest] = body

    let firstHeaders = []
    if(is.singleRelation(first)){
        rel = resolve(first[types.line][0])
        return doRelationOperations (rel, rest, env)
    } else if(is.relation_literal(first)){
        rel = resolve(first)
        return doRelationOperations (rel, rest, env)
    } else if (is.singleVar(first)){
        throw new errors.NotImplemented('not implemented single var sets yet')
    } else if (is.singleSet(first)){
        return first[types.line][0]
        // then do any set operations...
    }
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