import {Node, NodeMultiple, NodeMinimal, is, deMunge} from './parser'

import * as R from 'ramda'

/**
 * Convert an AST node to a source string.
 * `o` is a node, `i` is the indent level.
 */
function nodeToString(o: Node, i: number): string {
    if(is.multiple(o)) return typeStringMap[o.type](o, i)
    return o.value
}

function many(o: NodeMultiple, i: number): string{
    const args = o.value
    const section = args.pop()
    return `${args.map(o=>nodeToString(o, i)).join(' ')}\n${nodeToString(section, i + 1)}`
}

const typeStringMap: { [s: string]: (o: NodeMultiple, i: number)=>string } = {
    section: (o, i)=>o.value.map(o=>o.type === 'section'?
        nodeToString(o, i + 1)
        : '    '.repeat(i) + nodeToString(o, i)
    ).join('\n'),
    let: (o, i)=>`let ${many(o, i)}\n`,
    def: (o, i)=>`def ${many(o, i)}\n`,
    line: (o, i)=>{
        if(is.section(R.last(o.value) || {})) return many(o, i)
        return o.value.map(o=>nodeToString(o, i)).join(' ')
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
        const [headers, ...rows] = o.value as Array<NodeMultiple>
        const headerStrings = headers.value.map(o=>nodeToString(o, i))
        const rowsStrings = rows.map(row=>row.value.map(o=>nodeToString(o, i)))
        const colWidths = R.transpose(rowsStrings.concat([headerStrings]))
            .map(col=>col.map(cell=>cell.length))
            .map(colLengths=>Math.max(...colLengths))
        function makeRow(strings: Array<string>): string{
            return '| ' +
            R.zip(strings, colWidths)
            .map(([string, colWidth])=>string.padEnd(colWidth, ' ') + ' ')
            .join('| ')
            + '|'
        }
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
function nodeToJson(o: Node, i: number): string{
    return R.tail(  // remove first \n
        JSON.stringify(o)
        .replace(/{"section":/g, '\n{"section":[')
        .replace(/{"line":/g, '\n    {"line":'))
}

export const astToString = (ast: NodeMinimal)=>nodeToString(deMunge(ast), 0)
export const jsonifyAndIndent = (ast: NodeMinimal)=>nodeToJson(ast, 1)
