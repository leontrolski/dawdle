import {Node, types, multiple, deMunge} from './parser'
import {log} from './errorsAndAsserters'

import * as R from 'ramda'

/**
 * Convert an AST node to a source string.
 * `o` is a node, `i` is the indent level.
 */
const nodeToString = (o, i)=>{
    if(R.contains(o.type, multiple)) return typeStringMap[o.type](o, i)
    return o.value
}
const typeStringMap = {
    section: (o, i)=>o.value.map(o=>o.type === 'section'?
        nodeToString(o, i + 1)
        : '    '.repeat(i) + nodeToString(o, i)
    ).join('\n'),
    let: (o, i)=>{
        const args = o.value
        const section = args.pop()
        return `let ${args.map(o=>nodeToString(o, i)).join(' ')}\n${nodeToString(section, i + 1)}\n`
    },
    def: (o, i)=>{
        const args = o.value
        const section = args.pop()
        return `def ${args.map(o=>nodeToString(o, i)).join(' ')}\n${nodeToString(section, i + 1)}\n`
    },
    line: (o, i)=>{
        const args = o.value
        if(args.length > 0 && (R.last(args) as Node).type === 'section'){
            const section = args.pop()
            return `${o.value.map(o=>nodeToString(o, i)).join(' ')}\n${nodeToString(section, i + 1)}`
        }
        return args.map(o=>nodeToString(o, i)).join(' ')
    },
    aggregator: (o, i)=>o.value.map(o=>nodeToString(o, i)).join(' '),
    map_macro: (o, i)=>{
        const [var_, template] = o.value
        return `(map ${nodeToString(var_, i)}) ${nodeToString(template, i)}`
    },
    named_value: (o, i)=>{
        const [var_, value] = o.value
        return `${nodeToString(var_, i)}=${nodeToString(value, i)}`
    },
    set: (o, i)=>`[${o.value.map(o=>nodeToString(o, i)).join(' ')}]`,
    relation_literal: (o, i)=>{
        const [headers, ...rows] = o.value
        const headerStrings = headers.value.map(o=>nodeToString(o, i))
        const rowsStrings = rows.map(row=>row.value.map(o=>nodeToString(o, i)))
        const colWidths = R.transpose(rowsStrings.concat([headerStrings]))
            .map(col=>col.map(cell=>(cell as {length}).length))
            .map(colLengths=>Math.max(...colLengths))
        const makeRow = strings=>
            '| ' +
            R.zip(strings, colWidths)
            .map(([string, colWidth])=>(string as {padEnd}).padEnd(colWidth, ' ') + ' ')
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
 * TODO: make this match up and indent line to line with dawdle source.
 */
const nodeToJson = (o, i)=>{
    return R.tail(
        JSON.stringify(o)
        .replace(/{"section":/g, '\n{"section":[')
        .replace(/{"line":/g, '\n    {"line":'))
}

export const astToString = ast=>nodeToString(deMunge(ast), 0)
export const jsonifyAndIndent = ast=>nodeToJson(ast, 1)
