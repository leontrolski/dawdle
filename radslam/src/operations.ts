import {Node, Header, Relation, Function, Value, Section, Set} from './parser'

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
 * Similar to determineHeaders, but for sets.
 *
 * TODO: maybe implement cross product.
 */
export const set: {[s: string]: any} = {
    union: (set: Set, ...rest: Value[])=>R.union(set.compiledValue, rest),
    difference: (set: Set, ...rest: Value[])=>R.difference(set.compiledValue, rest),
}
