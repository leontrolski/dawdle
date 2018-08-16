const {parser, types, getType, multiple, is, assertIs, baseOperatorInverseMap} = require('./parser')
const {errors, asserters, log} = require('./errorsAndAsserters')

const R = require('ramda')

const typeToString = o=>{
    const type_ = getType(o)
    if(multiple.includes(type_)) return typeStringMap[type_](o)
    return o[type_]
}
const typeStringMap = {
    section: o=>o[types.section].map(typeToString).join('\n'),
    let: o=>{
        const args = o[types.let]
        const section = args.pop()
        return `let ${args.map(typeToString).join(' ')}\n${typeToString(section)}`
    },
    def: o=>{
        const args = o[types.def]
        const section = args.pop()
        return `def ${args.map(typeToString).join(' ')}\n${typeToString(section)}`
    },
    line: o=>o[types.line].map(typeToString).join(' '),
    aggregator: o=>o[types.aggregator].map(typeToString).join(' '),
    map_macro: o=>{
        const [var_, template] = o[types.map_macro]
        return `(map ${typeToString(var_)}) ${typeToString(template)}`
    },

    named_value: o=>{
        const [var_, value] = o[types.named_value]
        return `${typeToString(var_)}=${typeToString(value)}`
    },
    // this will require some special work
    relation_literal: o=>o[types.relation_literal],
    rl_headers: o=>o[types.rl_headers],
    rl_row: o=>o[types.rl_row],
    set: o=>`[${o[types.set].map(typeToString).join(' ')}]`,
}

const astToString = ast=>{
    let indentLevel = 0
    return typeToString(ast)
}

module.exports = {astToString}