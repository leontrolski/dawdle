const {types} = require('./parser')

const R = require('ramda')

/**
 * Map of base operator type to a function that determines
 * the headers for that type. Function signatures are useful
 * in that they spell out the operator's signature.
 */
const determineHeaders = {
    filter: (rel, func, ...values)=>rel.compiledValue,
    select: (rel, ...headers)=>headers,
    extend: (rel, header, func, ...values)=>R.union(rel.compiledValue, [header]),
    cross: (rel, value)=>rel.compiledValue.concat(value.compiledValue),
    union: (rel, value)=>rel.compiledValue,
    difference: (rel, value)=>rel.compiledValue,
    join: (rel, value)=>R.union(rel.compiledValue, value.compiledValue),
    group: (rel, ...headers_aggregators)=>{
        const [aggregators, ...headers] = headers_aggregators.reverse()
        return headers.reverse().concat(aggregators.compiledValue)
    }
}
/**
 * Similar to determineHeaders, but for sets.
 *
 * TODO: maybe implement cross product.
 */
const determineSet = {
    union: (set, ...rest)=>R.union(set.compiledValue, rest),
    difference: (set, ...rest)=>R.difference(set.compiledValue, rest),
}

module.exports = {
    [types.set]: determineSet,
    [types.headers]: determineHeaders,
}