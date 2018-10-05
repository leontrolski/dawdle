import { Map } from 'immutable'
import * as R from "ramda"

import { FunctionAPI, DawdleModuleAPI, RelationAPI } from "./shared"
import { Header, Value, Let, Def, types, NodeSingle, Node } from "./parser"
import { Env, toJSONValue, valueToNode } from "./compiler"

function toNameAndLetNode(thing: any): [string, any] {  // should be (FunctionAPI-like-thing)=>[string, Node]
    return [
        thing.name,
        {
            type: types.let,
            value: [{type: types.var, value: thing.name}, R.dissoc('name', thing)]
        }
    ]
}
export function makeFilter(name: string, f: (a: any, ...bs: any[])=>any): [string, any] {  // TODO: maybe improve the type of `f`
    return toNameAndLetNode({
        name: name,  // TODO: should name even be a property here (see dissoc above)
        type: 'filter',
        args: [],  // TODO: make all these do something
        func: (rel: RelationAPI, a: Header, ...bs: Value[])=>{
            const iToFilterOn = rel.headers.indexOf(a.value.slice(1))
            return {
                headers: rel.headers,
                rows: rel.rows.filter(row=>f(row[iToFilterOn], ...bs.map(b=>toJSONValue(b as NodeSingle))))
            }
        }
    })
}
export function makeAggregator(name: string, f: (...xs: any[])=>any): [string, any] {  // TODO: maybe improve the type of `f`
    return toNameAndLetNode({
        name: name,  // TODO: should name even be a property here (see dissoc above)
        type: 'aggregate',
        args: [],  // TODO: make all these do something
        func: (rel: RelationAPI, aggregateBy: Header[], ...args: Header[])=>{
            const aggregateByStrings = aggregateBy.map(a=>a.value.slice(1))
            const isToAggregateBy = rel.headers
                .map((header, i)=>aggregateByStrings.includes(header)? i : null)
                .filter(x=>!R.isNil(x))
            // asume there is one argument that is the header to aggregate by
            const iToSelect = rel.headers.indexOf(args[0].value.slice(1))
            const aggregateMap = {}
            for(let row of rel.rows){
                const groupBy = isToAggregateBy.map(i=>row[i])
                const k = JSON.stringify(groupBy)
                if(R.isNil(aggregateMap[k])) aggregateMap[k] = []
                aggregateMap[k].push(row[iToSelect])
            }
            // returns {
            //    JSON.stringify([value, otherValue, ...]): // in order specified in `aggregateBy`
            //        aggregatedValue
            // }
            return R.mapObjIndexed((v, _)=>f(v), aggregateMap)
        }
    })
}
export function makeValue(name: string, value: any): [string, any] {
    return toNameAndLetNode({name: name, ... valueToNode(value)})
}
function sqlLikeToRegex(str: string): RegExp {
    const escaped = str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
    const replaceSQL = escaped.replace(/%/g, '.+').replace(/_/g, '.')
    return new RegExp(`^${replaceSQL}$`)
}
export const env: Env = Map([
    makeFilter('eq', (a, b)=>a === b),
    makeFilter('lt', (a, b)=>a < b),
    makeFilter('gt', (a, b)=>a > b),
    makeFilter('lte', (a, b)=>a <= b),
    makeFilter('gte', (a, b)=>a >= b),
    makeFilter('like', (a, b)=>sqlLikeToRegex(b).test(a)),
    makeFilter('isnull', (a)=>R.isNil(a)),
    makeFilter('isnotnull', (a)=>!R.isNil(a)),
    // TODO: remove these
    makeFilter('fake_function', (a)=>!R.isNil(a)),
    makeFilter('make_null', (a)=>!R.isNil(a)),
    makeFilter('first', (a)=>!R.isNil(a)),
    makeFilter('value', (a)=>!R.isNil(a)),
])
