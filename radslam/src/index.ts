import { zip, merge, last, transpose, repeat, intersperse } from 'ramda'
import * as m from 'mithril'
import * as ace from 'ace-builds/src-noconflict/ace'
ace.config.set('basePath', './')

import { ServerBlock, serverBlocks } from './server'
import { Node, NodeMultiple, NodeCompiled, is } from './parser'

// server
function readFromServer(): Promise<State>{
    return new Promise((resolve, reject)=>resolve({serverBlocks}))//, serverAst})
    // actually f(fileState.source)
}
function writeToServer(){}// f(fileState.source)}

type Block = ServerBlock & {id: string}

type State = {
    serverBlocks: Array<ServerBlock>
}
type DerivedState = {
    blocks: Array<Block>
}

// empty state to start with
let state: State = {
    serverBlocks: []
}
function setState(s: State): void{state = s}

// deriving functions
function deriveIds(state: State): Array<string>{
    return state.serverBlocks.map((_, i)=>`editor-${i}`)
}
function deriveState(state: State): DerivedState{
    const ids = deriveIds(state).map(id=>({id}))
    const blocks = zip(state.serverBlocks, ids).map(([a, b])=>merge(a, b))
    return {blocks}
}
// UI components
function nodeToHyperscript(o: Node, i: number): m.Vnode {
    if(is.multiple(o)) return typeStringMap[o.type](o, i)
    return m('span', o.value)
}

function many(o: NodeMultiple, i: number): m.Vnode[]{
    const args = o.value
    const section = args.pop()
    return intersperse(space, args.map(o=>nodeToHyperscript(o, i))).concat([newline, nodeToHyperscript(section, i + 1)])
}
const tab = m('span', '    ')
const space = m('span', ' ')
const newline = m('span', '\n')
const typeStringMap: { [s: string]: (o: NodeMultiple, i: number)=>m.Vnode } = {
    section: (o, i)=>m('span.section', intersperse(newline, o.value.map(o=>o.type === 'section'?
        nodeToHyperscript(o, i + 1)
        : m('span', [repeat(tab, i), nodeToHyperscript(o, i)])
    ))),
    let: (o, i)=>m('span.let', 'let ', many(o, i), newline),
    def: (o, i)=>m('span.def', 'def ', many(o, i), newline),
    line: (o, i)=>{
        if(is.section(last(o.value) || {})) return m('span.line', many(o, i))
        return m('span.line', intersperse(space, o.value.map(o=>nodeToHyperscript(o, i))))
    },
    aggregator: (o, i)=>m('span', o.value.map(o=>nodeToHyperscript(o, i))),
    map_macro: (o, i)=>{
        const [var_, template] = o.value
        return m('span', '(map ', nodeToHyperscript(var_, i), space, nodeToHyperscript(template, i))
    },
    named_value: (o, i)=>{
        const [var_, value] = o.value
        return m('span', nodeToHyperscript(var_, i), '=', nodeToHyperscript(value, i))
    },
    set: (o, i)=>m('span', '[', o.value.map(o=>nodeToHyperscript(o, i)), ']'),
    relation_literal: (o, i)=>{
        const [headers, ...rows] = o.value as Array<NodeMultiple>
        const toText = span=>typeof span.text == 'string'? span.text: ''
        const headerStrings = headers.value.map(o=>nodeToHyperscript(o, i)).map(toText)
        const rowsStrings = rows.map(row=>row.value.map(o=>nodeToHyperscript(o, i)).map(toText))
        const colWidths = transpose(rowsStrings.concat([headerStrings]))
            .map(col=>col.map(cell=>cell.length))
            .map(colLengths=>Math.max(...colLengths))
        function makeRow(strings: Array<string>): string{
            return '| ' +
            zip(strings, colWidths)
            .map(([string, colWidth])=>string.padEnd(colWidth, ' ') + ' ')
            .join('| ')
            + '|'
        }
        const headerString = makeRow(headerStrings)
        const divider =  rows.length > 0? '\n' + '-'.repeat(headerString.length) + '\n' : ''
        const rowsString = rowsStrings.map(makeRow).join('\n')
        return m('span.relation_literal', headerString + divider + rowsString)
    },
}
const OriginalBlock = (block: Block)=>m(
    '.source.left', m('', {id: block.id, language: block.language}, block.source))

const InfoBlock = (info: NodeCompiled | null)=>info === null? null :
    m('.source.pre.right', nodeToHyperscript(info as Node, 0))

const View = ()=>m('div',
    deriveState(state).blocks.map((block, i)=>
        m('.block',
            OriginalBlock(block),
            InfoBlock(block.astWithHeaders)),
))

function loadEditors(ids: Array<string>): Array<AceAjax.Editor>{
    const editors = ids.map(id=>{
        const editorElement = document.getElementById(id)
        const language = editorElement.getAttribute('language')
        return ace.edit(editorElement, {
            maxLines: Infinity,
            mode: `ace/mode/${language}`,  // live in dist/mode-${language}.js
            // turn off highlighting until focused
            showGutter: false,
            showPrintMargin: false,
            highlightActiveLine: false,
        })
    })
    zip(editors, ids).forEach(([editor, id])=>{
        editor.renderer.$cursorLayer.element.style.display = 'none'
        const otherEditors = editors.filter(e=>e !== editor)
        function setHighlight(){
            editor.setHighlightActiveLine(true)
            editor.setHighlightSelectedWord(true)
            editor.renderer.$cursorLayer.element.style.display = 'block'
            otherEditors.forEach(editor=>editor.setHighlightActiveLine(false))
            otherEditors.forEach(editor=>editor.setHighlightSelectedWord(false))
            otherEditors.forEach(editor=>editor.selection.clearSelection())
            otherEditors.forEach(editor=>editor.renderer.$cursorLayer.element.style.display = 'none')
        }
        editor.container.children[0].onfocus = setHighlight
    })
    return editors
}

async function init(){
    m.mount(document.body, {view: View})
    const newState = await readFromServer()
    setState(newState)
    await m.redraw()
    const ids = deriveIds(state)
    await requestAnimationFrame(()=>loadEditors(ids))
}
init()

export let test
