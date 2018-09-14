import { zip, merge, last, transpose, repeat, intersperse, sortBy } from 'ramda'
import * as m from 'mithril'
import * as ace from 'ace-builds/src-noconflict/ace'
ace.config.set('basePath', './')

import { ServerBlock, serverBlocks, languages } from './server'
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
function nodeToHyperscript(o: Node): m.Vnode {
    let lineI = -1
    const vnodes = []
    function getNewLineI(){
        lineI += 1
        return lineI
    }
    function inner(o: Node): m.Vnode {
        if(is.multiple(o)) return typeStringMap[o.type](o)
        return m('span', o.value)
    }
    function many(o: NodeMultiple): m.Vnode[]{
        const args = o.value
        const section = args.pop()
        return intersperse(space, args.map(o=>inner(o))).concat([newline, inner(section)])
    }
    const space = m('span', ' ')
    const newline = m('span', '\n')
    const typeStringMap: {[s: string]: (o: NodeMultiple)=>m.Vnode} = {
        section: o=>m('span.section', intersperse(newline, o.value.map(o=>o.type === 'section'?
            inner(o)
            : m('span', [inner(o)])
        ))),
        let: o=>{
            const newLineI = getNewLineI()
            const let_ = m('span.let', newLineI, 'let ', many(o), newline)
            vnodes.push({lineI: newLineI, o})
            getNewLineI()
            return let_
        },
        def: o=>{
            const newLineI = getNewLineI()
            const def = m('span.def', newLineI, 'def ', many(o), newline)
            vnodes.push({lineI: newLineI, o})
            getNewLineI()
            return def
        },
        line: o=>{
            let line
            const newLineI = getNewLineI()
            if(is.section(last(o.value) || {})) line = m('span.line', newLineI, many(o))
            else line = m('span.line', newLineI, intersperse(space, o.value.map(o=>inner(o))))
            vnodes.push({lineI: newLineI, o})
            return line
        },
        aggregator: o=>m('span', o.value.map(o=>inner(o))),
        map_macro: o=>{
            const [var_, template] = o.value
            return m('span', '(map ', inner(var_), space, inner(template))
        },
        named_value: o=>{
            const [var_, value] = o.value
            return m('span', inner(var_), '=', inner(value))
        },
        set: o=>m('span', '[', o.value.map(o=>inner(o)), ']'),
        relation_literal: o=>{
            const [headers, ...rows] = o.value as Array<NodeMultiple>
            const toText = span=>typeof span.text == 'string'? span.text: ''
            const headerStrings = headers.value.map(o=>inner(o)).map(toText)
            const rowsStrings = rows.map(row=>row.value.map(o=>inner(o)).map(toText))
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
            const newLineI = getNewLineI()
            const headerSpan = m('span', newLineI, makeRow(headerStrings).trim())
            vnodes.push({lineI: newLineI, o})
            const divider =  rows.length > 0?
                m('span.divider', newline, getNewLineI(), '-'.repeat(6), newline)//toText(headerSpan).length), newline)
                : null
            const rowsSpans = intersperse(newline, rowsStrings.map(makeRow).map(s=>m('span', getNewLineI(), s)))
            return m('span.relation_literal', headerSpan, divider, rowsSpans)
        },
    }
    const rar = inner(o as Node)
    const nodes = sortBy(n=>n.lineI, vnodes) as Array<{lineI: number, o: NodeCompiled}>
    return m('span', intersperse(newline, nodes
        .filter(n=>n.o.compiledType === 'headers')
        .map(n=>m('span', n.lineI, n.o.compiledValue.map(v=>v.value)))))
    // window.o = o
    // return rar
    // return m('span', intersperse(newline, vnodes))
}

const OriginalBlock = (block: Block)=>m(
    '.source.left',
    {class: block.language === languages.dawdle? 'language-dawdle' : ''},
    m('', {id: block.id, language: block.language}, block.source)
)

const InfoBlock = (info: NodeCompiled | null)=>info === null? null :
    m('.source.pre.right', nodeToHyperscript(info as Node))

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
