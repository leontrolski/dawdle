const {parser, types, getType, multiple, is, assertIs, baseOperatorInverseMap} = require('./parser')
const {errors, asserters, log} = require('./errorsAndAsserters')

const R = require('ramda')

// `o` is a node, `i` is the indent level
const nodeToString = (o, i)=>{
    const type_ = getType(o)
    if(multiple.includes(type_)) return typeStringMap[type_](o, i)
    return o[type_]
}
const typeStringMap = {
    section: (o, i)=>o[types.section].map(o=>is.section(o)?
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
    line: (o, i)=>o[types.line].map(o=>nodeToString(o, i)).join(' '),
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
    // this will require some special work
    relation_literal: (o, i)=>{
        const [headers, ...rows] = o[types.relation_literal]
        const headerStrings = headers[types.rl_headers].map(o=>nodeToString(o, i))
        const rowsStrings = rows.map(row=>row[types.rl_row].map(o=>nodeToString(o, i)))
        const colWidths = R.transpose(rowsStrings.concat([headerStrings]))
            .map(col=>col.map(cell=>cell.length))
            .map(colLengths=>Math.max(...colLengths))
        // colWidths = [5, 6, 7]
        // | width | widthh | widthhh |
        // ----------------------------
        // 1234567890123456789012345678
        const makeRow = strings=>
            '| ' +
            R.zip(strings, colWidths)
            .map(([string, colWidth])=>`${string.padEnd(colWidth, ' ')} `)
            .join('| ')
            + '|'
        const headerString = makeRow(headerStrings)
        const divider =  rows.length > 0? '\n' + '-'.repeat(headerString.length) + '\n' : ''
        const rowsString = rowsStrings.map(makeRow).join('\n')
        return headerString + divider + rowsString
    },
}

const astToString = ast=>nodeToString(ast, 0)

module.exports = {astToString}