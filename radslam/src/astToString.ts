import {Node, NodeMultiple, NodeMinimal, is, deMunge} from './parser'

import * as R from 'ramda'

/**
 * Convert an AST node to a source string.
 * `o` is a node, `i` is the indent level.
 */
function nodeToString_(o: Node, i: number): string {
    if(is.multiple(o)) return typeStringMap[o.type](o, i)
    return o.value
}

function many(o: NodeMultiple, i: number): string{
    const args = o.value
    const section = args.pop()
    return `${args.map(o=>nodeToString_(o, i)).join(' ')}\n${nodeToString_(section, i + 1)}`
}

const typeStringMap: { [s: string]: (o: NodeMultiple, i: number)=>string } = {
    section: (o, i)=>o.value.map(o=>o.type === 'section'?
        nodeToString_(o, i + 1)
        : '    '.repeat(i) + nodeToString_(o, i)
    ).join('\n'),
    let: (o, i)=>`let ${many(o, i)}\n`,
    def: (o, i)=>`def ${many(o, i)}\n`,
    line: (o, i)=>{
        if(is.section(R.last(o.value) || {} as Node)) return many(o, i)
        return o.value.map(o=>nodeToString_(o, i)).join(' ')
    },
    aggregator: (o, i)=>o.value.map(o=>nodeToString_(o, i)).join(' '),
    map_macro: (o, i)=>{
        const [var_, template] = o.value
        return `(map ${nodeToString_(var_, i)}) ${nodeToString_(template, i)}`
    },
    named_value: (o, i)=>{
        const [var_, value] = o.value
        return `${nodeToString_(var_, i)}=${nodeToString_(value, i)}`
    },
    set: (o, i)=>`[${o.value.map(o=>nodeToString_(o, i)).join(' ')}]`,
    relation_literal: (o, i)=>{
        const [headers, ...rows] = o.value as Array<NodeMultiple>
        const headerStrings = headers.value.map(o=>nodeToString_(o, i))
        const rowsStrings = rows.map(row=>row.value.map(o=>nodeToString_(o, i)))
        const colWidths = R.transpose(rowsStrings.concat([headerStrings]))
            .map(col=>col.map(cell=>cell.length))
            .map(colLengths=>Math.max(...colLengths))
        function makeRow(strings: Array<string>): string{
            return '    '.repeat(i) +
            '| ' +
            R.zip(strings, colWidths)
            .map(([string, colWidth])=>string.padEnd(colWidth, ' ') + ' ')
            .join('| ')
            + '|'
        }
        const headerString = makeRow(headerStrings).trim()
        const divider =  rows.length > 0? '\n' + '    '.repeat(i) + '-'.repeat(headerString.length) + '\n' : ''
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
export function jsonifyAndIndent(o: NodeMinimal): string{
    const s = JSON.stringify(o)
        .replace(/{"section":/g, '\n{"section":')
        .replace(/{"line":/g, '\n    {"line":')
        .replace(/{"rl_headers":/g, '\n    {"rl_headers":')
        .replace(/{"rl_row":/g, '\n    {"rl_row":')
    JSON.parse(s)
    return R.tail(s)  // remove first \n
}

export const astToString = (ast: NodeMinimal)=>nodeToString_(deMunge(ast), 0)
export const nodeToString = (o: Node)=>nodeToString_(o, 0)
