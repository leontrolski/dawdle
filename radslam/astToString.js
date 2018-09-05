const {types, getType, multiple} = require('./parser')
const {log} = require('./errorsAndAsserters')

const R = require('ramda')

/**
 * Convert an AST node to a source string.
 * `o` is a node, `i` is the indent level.
 */
const nodeToString = (o, i)=>{
    const type_ = getType(o)
    if(multiple.includes(type_)) return typeStringMap[type_](o, i)
    return o[type_]
}
const typeStringMap = {
    section: (o, i)=>o[types.section].map(o=>getType(o) === 'section'?
        nodeToString(o, i + 1)
        : '    '.repeat(i) + nodeToString(o, i)
    ).join('\n'),
    let: (o, i)=>{
        const args = o[types.let]
        const section = args.pop()
        return `let ${args.map(o=>nodeToString(o, i)).join(' ')}\n${nodeToString(section, i + 1)}\n`
    },
    def: (o, i)=>{
        const args = o[types.def]
        const section = args.pop()
        return `def ${args.map(o=>nodeToString(o, i)).join(' ')}\n${nodeToString(section, i + 1)}\n`
    },
    line: (o, i)=>{
        const args = o[types.line]
        if(args.length > 0 && getType(R.last(args)) === 'section'){
            section = args.pop()
            return `${o[types.line].map(o=>nodeToString(o, i)).join(' ')}\n${nodeToString(section, i + 1)}`
        }
        return o[types.line].map(o=>nodeToString(o, i)).join(' ')
    },
    aggregator: (o, i)=>o[types.aggregator].map(o=>nodeToString(o, i)).join(' '),
    map_macro: (o, i)=>{
        const [var_, template] = o[types.map_macro]
        return `(map ${nodeToString(var_, i)}) ${nodeToString(template, i)}`
    },
    named_value: (o, i)=>{
        const [var_, value] = o[types.named_value]
        return `${nodeToString(var_, i)}=${nodeToString(value, i)}`
    },
    set: (o, i)=>`[${o[types.set].map(o=>nodeToString(o, i)).join(' ')}]`,
    relation_literal: (o, i)=>{
        const [headers, ...rows] = o[types.relation_literal]
        const headerStrings = headers[types.rl_headers].map(o=>nodeToString(o, i))
        const rowsStrings = rows.map(row=>row[types.rl_row].map(o=>nodeToString(o, i)))
        const colWidths = R.transpose(rowsStrings.concat([headerStrings]))
            .map(col=>col.map(cell=>cell.length))
            .map(colLengths=>Math.max(...colLengths))
        const makeRow = strings=>
            '| ' +
            R.zip(strings, colWidths)
            .map(([string, colWidth])=>string.padEnd(colWidth, ' ') + ' ')
            .join('| ')
            + '|'
        const headerString = makeRow(headerStrings)
        const divider =  rows.length > 0? '\n' + '-'.repeat(headerString.length) + '\n' : ''
        const rowsString = rowsStrings.map(makeRow).join('\n')
        return headerString + divider + rowsString
    },
}

/**
 * Convert an AST object to JSON string, indented by section.
 * `o` is a node, `i` is the indent level.
 *
 * TODO: make this match up line to line with dawdle source.
 */
const nodeToJson = (o, i)=>{
    const type_ = getType(o)
    const indent = '    '.repeat(i)
    if(getType(o) === 'section') return `{"section":[\n${indent}${o[type_].map(o=>nodeToJson(o, i + 1)).join(',\n' + indent)}]}`
    if(multiple.includes(type_)) return `{"${type_}":[${o[type_].map(o=>nodeToJson(o, i)).join(',')}]}`
    return JSON.stringify(o)
}

const astToString = ast=>nodeToString(ast, 0)
const jsonifyAndIndent = ast=>nodeToJson(ast, 1)

module.exports = {astToString, jsonifyAndIndent}