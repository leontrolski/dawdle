const R = require('ramda')

/**
 * Map of base operator type to a function that determines
 * the headers for that type. Function signatures are useful
 * in that they spell out the operator's signature.
 */
const determineHeaders = {
    filter: (rel, func, ...values)=>rel.headers,
    select: (rel, ...headers)=>headers,
    extend: (rel, header, func, ...values)=>R.union(rel.headers, [header]),
    cross: (rel, value)=>rel.headers.concat(value.headers),
    union: (rel, value)=>rel.headers,
    difference: (rel, value)=>rel.headers,
    join: (rel, value)=>R.union(rel.headers, value.headers),
    group: (rel, ...headers_aggregators)=>{
        const [aggregators, ...headers] = headers_aggregators.reverse()
        return headers.reverse().concat(aggregators.headers)
    }
}
/**
 * Similar to determineHeaders, but for sets.
 *
 * TODO: maybe implement cross product.
 */
const determineSet = {
    union: (set, ...rest)=>R.union(set.setValues, rest),
    difference: (set, ...rest)=>R.difference(set.setValues, rest),
}

module.exports = {determineHeaders, determineSet}