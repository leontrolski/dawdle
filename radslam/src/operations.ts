import { Node, Header, Relation, Function, Value, Section, Set } from './parser'
import { RelationAPI, FunctionAPI } from './shared'

import * as R from 'ramda'

/**
 * Map of base operator type to a function that determines
 * the headers for that type. Function signatures are useful
 * in that they spell out the operator's signature.
 */
export const headers: {[s: string]: any} = {
    filter: (rel: Relation, func: Function, ...values: Value[])=>rel.compiledValue,
    select: (rel: Relation, ...headers: Header[])=>headers,
    extend: (rel: Relation, header: Header, func: Function, ...values: Value[])=>R.union(rel.compiledValue, [header]),
    cross: (rel: Relation, value: Value)=>rel.compiledValue.concat(value.compiledValue),
    union: (rel: Relation, value: Value)=>rel.compiledValue,
    difference: (rel: Relation, value: Value)=>rel.compiledValue,
    join: (rel: Relation, value: Value)=>R.union(rel.compiledValue, value.compiledValue),
    group: (rel: Relation, ...headers_aggregators: (Header | Section)[])=>{
        const [aggregators, ...headers] = headers_aggregators.reverse()
        return headers.reverse().concat(aggregators.compiledValue)
    }
}
/**
 * Map of base operator type to a function that determines
 * the relation for that type.
 */
export const relation: {[s: string]: (rel: Relation, ...args: any[])=>RelationAPI} = {
    filter: (rel: Relation, func: FunctionAPI, ...values: Value[])=>{
        // assert function.type === 'filter'
        return rel.compiledValue// TODO: func.function(rel.compiledValue, ...values)
    },
    select: (rel: Relation, ...headers: Header[])=>{
        const left = rel.compiledValue as RelationAPI
        const selectHeaders = headers.map(header=>header.value.slice(1))
        const leftKVs = left.rows.map(row=>R.fromPairs(R.zip(left.headers, row)))
        const rows = leftKVs.map(kv=>selectHeaders.map(header=>kv[header]))
        return {headers: selectHeaders, rows: rows}
    },
    extend: (rel: Relation, header: Header, func: FunctionAPI, ...values: Value[])=>{
        // assert function.type === 'extend'
        return rel.compiledValue// TODO: func.function(rel.compiledValue, header, ...values)
    },
    cross: (rel: Relation, value: Value)=>{
        const left = rel.compiledValue as RelationAPI
        const right = value.compiledValue as RelationAPI
        const resultingHeaders = left.headers.concat(right.headers)
        const rows: any[][] = []
        for(let leftRow of left.rows){
            for(let rightRow of right.rows){
                rows.push(leftRow.concat(rightRow))
            }
        }
        return {headers: resultingHeaders, rows: rows}
    },
    union: (rel: Relation, value: Value)=>{
        const left = rel.compiledValue as RelationAPI
        const right = value.compiledValue as RelationAPI
        const rightKVs = right.rows.map(row=>R.fromPairs(R.zip(right.headers, row)))
        const rightRows = rightKVs.map(kv=>left.headers.map(header=>kv[header]))
        return {headers: left.headers, rows: R.union(left.rows, rightRows)}
    },
    difference: (rel: Relation, value: Value)=>{
        const left = rel.compiledValue as RelationAPI
        const right = value.compiledValue as RelationAPI
        const rightKVs = right.rows.map(row=>R.fromPairs(R.zip(right.headers, row)))
        const rightRows = rightKVs.map(kv=>left.headers.map(header=>kv[header]))
        return {headers: left.headers, rows: R.difference(left.rows, rightRows)}
    },
    join: (rel: Relation, value: Value)=>{
        const left = rel.compiledValue as RelationAPI
        const right = value.compiledValue as RelationAPI
        const joinOn = R.intersection(left.headers, right.headers)
        const resultingHeaders = R.union(left.headers, right.headers)
        const hashMap: {[k: string]: {[k2: string]: any}[]} = {}
        for(let row of right.rows){
            const sortedPairs = R.sortBy(([header, _])=>header, R.zip(right.headers, row))
            const joinPairs = sortedPairs.filter(([header, _])=>joinOn.includes(header))
            const rightKV = R.fromPairs(sortedPairs.filter(([header, _])=>!joinOn.includes(header)))
            const hashKey = JSON.stringify(joinPairs)
            const l = hashMap[hashKey] || (hashMap[hashKey] = [])
            l.push(rightKV)
        }
        const joined = []
        for(let row of left.rows){
            const sortedPairs = R.sortBy(([header, _])=>header, R.zip(left.headers, row))
            const joinPairs = sortedPairs.filter(([header, _])=>joinOn.includes(header))
            const hashKey = JSON.stringify(joinPairs)
            const l = hashMap[hashKey] || []
            for(let rightKV of l){
                const joinedRow = []
                for(let header of resultingHeaders){
                    joinedRow.push(rightKV[header] || R.fromPairs(sortedPairs)[header])
                }
                joined.push(joinedRow)
            }
        }
        return {headers: resultingHeaders, rows: joined}
    },
    group: (rel: Relation, ...headers_aggregators: (Header | Section)[])=>{
        // assert all function.type === 'aggregate'
        // const [aggregators, ...headers] = headers_aggregators.reverse()
        // return headers.reverse().concat(aggregators.compiledValue)
        return {headers: [], rows: []}
    }
}
/**
 * Similar to determineHeaders, but for sets.
 *
 * TODO: maybe implement cross product.
 */
export const set: {[s: string]: any} = {
    union: (set: Set, ...rest: Value[])=>R.union(set.compiledValue, rest),
    difference: (set: Set, ...rest: Value[])=>R.difference(set.compiledValue, rest),
}
