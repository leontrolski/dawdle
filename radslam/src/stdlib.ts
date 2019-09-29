import { Map } from 'immutable'
import * as R from "ramda"

import { FunctionAPI, DawdleModuleAPI, RelationAPI } from "./shared"
import { Header, Value, Let, Def, types, NodeSingle, Node, is, Number, NamedValue } from "./parser"
import { Env, toJSONValue, valueToNode } from "./compiler"
import { MissingArgs } from './errorsAndAsserters'

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
export function makeExtend(name: string, f: (...xs: any[])=>any): [string, any] {  // TODO: maybe improve the type of `f`
    return toNameAndLetNode({
        name: name,  // TODO: should name even be a property here (see dissoc above)
        type: 'extend',
        args: [],  // TODO: make all these do something
        func: (rel: RelationAPI, newHeader: Header, ...args: NodeSingle[])=>{
            const newHeaderString = newHeader.value.slice(1)
            const dropI = rel.headers.indexOf(newHeaderString)
            const dropFunc = row=>row.filter((n, i)=>i !== dropI)
            const rows = []
            for(let row of rel.rows){
                const argValues = args.map(arg=>is.header(arg)?
                    row[rel.headers.indexOf(arg.value.slice(1))]
                    : toJSONValue(arg))
                rows.push(dropFunc(row).concat([f(...argValues)]))
            }
            return {
                headers: dropFunc(rel.headers).concat([newHeaderString]),
                rows,
            }
        }
    })
}
export function makeAggregate(name: string, f: (...xs: any[])=>any): [string, any] {
    return toNameAndLetNode({
        name: name,  // TODO: see above
        type: 'aggregate',
        args: [],  // TODO: see above
        // returns {
        //    // in order specified in `aggregateBy`
        //    JSON.stringify([value, otherValue, ...]) :         aggregatedValue
        // }
        func: (rel: RelationAPI, aggregateBy: Header[], ...args: Header[])=>{
            // TODO: maybe most of this should live in operations.ts
            const aggregateByStrings = aggregateBy.map(a=>a.value.slice(1))
            const isToAggregateBy = rel.headers
                .map((header, i)=>aggregateByStrings.includes(header)? i : null)
                .filter(x=>!R.isNil(x))
            // asume the first arg is the header to aggregate
            const aggregateHeaderString = args[0].value.slice(1)
            const iToSelect = rel.headers.indexOf(aggregateHeaderString)
            const aggregateMap = {}
            for(let row of rel.rows){
                const groupBy = isToAggregateBy.map(i=>row[i])
                const k = JSON.stringify(groupBy)
                if(R.isNil(aggregateMap[k])) aggregateMap[k] = []
                aggregateMap[k].push(row[iToSelect])
            }
            // we pass args into f as well, just in case it is a percentile function etc.
            return R.mapObjIndexed((v, _)=>f(v, args), aggregateMap)
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
// rank
const rank = toNameAndLetNode({
    name: 'rank',
    type: 'extend',
    args: [],  // TODO: make all these do something
    func: (rel: RelationAPI, newHeader: Header, ...args: any[])=>{
        // pop named values
        const named = {}
        const sortByHeaders = []
        for(let arg of args){
            if(is.named_value(arg)) named[arg.value[0].value] = arg.value[1]
            else sortByHeaders.push(arg)
        }
        const sortByStrings = sortByHeaders.map(a=>a.value.slice(1))
        const headerIMap = R.fromPairs(rel.headers
            .map((header, i)=>[header, sortByStrings.includes(header)? i : null] as [string, number]))
        const isToSortBy = sortByStrings.map(header=>headerIMap[header])

        const newHeaderString = newHeader.value.slice(1)
        const dropI = rel.headers.indexOf(newHeaderString)
        const dropFunc = row=>row.filter((n, i)=>i !== dropI)

        // what about datetimes etc
        let sorter = (named['desc'] && toJSONValue(named['desc']))? R.descend : R.ascend
        let sorters = isToSortBy.map(i=>sorter(row=>row[i].value || row[i]))
        let partitionByI = named['partition_by']? rel.headers.indexOf(named['partition_by'].value.slice(1)) : null
        if(partitionByI) sorters = [R.ascend(row=>row[partitionByI].value || row[partitionByI]), ...sorters]
        const sortedRows = R.sortWith(
            sorters,
            rel.rows as number[][]
        ) as any[]

        let i = -1
        let prevRow = {}
        const rows = []
        for(let row of sortedRows){
            if(partitionByI && row[partitionByI] !== prevRow[partitionByI]) rows.push([...row, (i = 0)])
            else if(R.equals(isToSortBy.map(i=>row[i]), isToSortBy.map(i=>prevRow[i]))) rows.push([...row, i])
            else rows.push([...row, (i += 1)])
            prevRow = row
        }
        return {
            headers: dropFunc(rel.headers).concat([newHeaderString]),
            rows: rows
        }
        return rel
    }
})
// multirelation
const multiRelation = toNameAndLetNode({
    name: '-[]-',
    type: 'multirelation',
    args: [],  // TODO: make all these do something
    func: (rel: RelationAPI, newHeader: Header, ...args: any[])=>rel
})
export const env: Env = Map([
    makeFilter('eq', (a, b)=>a === b),
    makeFilter('lt', (a, b)=>a < b),
    makeFilter('gt', (a, b)=>a > b),
    makeFilter('lte', (a, b)=>a <= b),
    makeFilter('gte', (a, b)=>a >= b),
    makeFilter('like', (a, b)=>sqlLikeToRegex(b).test(a)),
    makeFilter('isnull', (a)=>R.isNil(a)),
    makeFilter('isnotnull', (a)=>!R.isNil(a)),
    makeExtend('multiply', (...xs)=>xs.reduce((a, b)=>a * b, 1)),
    makeAggregate('sum', (xs)=>xs.reduce((a, b)=>a + b, 0)),
    makeAggregate('max', (xs)=>Math.max(...xs)),
    makeAggregate('min', (xs)=>Math.min(...xs)),
    rank,
    multiRelation,
    // TODO: remove these
    makeFilter('fake_function', (a)=>!R.isNil(a)),
    makeFilter('make_null', (a)=>!R.isNil(a)),
    makeFilter('first', (a)=>!R.isNil(a)),
    makeFilter('value', (a)=>!R.isNil(a)),
])
