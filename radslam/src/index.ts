import { default as axios } from 'axios'
import { zip, merge, sortBy } from 'ramda'
import * as m from 'mithril'
import * as ace from 'ace-builds/src-noconflict/ace'
ace.config.set('basePath', './modes/')

import { DAWDLE_URL, ServerBlock } from './shared'
import { Node, NodeMultiple, is } from './parser'

// TODO:
// - sort out editor/source/original naming inconsistencies

// constants that map to css
const SVG_OFFSET = 1000
const INFO_ORIGINAL_GAP = 50

// server
async function readFromServer(): Promise<Array<ServerBlock>>{
    const response = await axios.get(DAWDLE_URL)
    return response.data
}
function writeToServer(){}// f(fileState.source)}

type Block = ServerBlock & {editorId: string, infoId: string}

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
function deriveEditorIds(state: State): Array<string> {
    return state.serverBlocks.map((_, i)=>`editor-${i}`)
}
function deriveInfoIds(state: State): Array<string> {
    return state.serverBlocks
        .map((block, i)=>({block, id: `info-${i}`}))
        .filter(both=>both.block.astWithHeaders)
        .map(both=>both.id)
}
function deriveState(state: State): DerivedState {
    const ids = deriveEditorIds(state).map(editorId=>({editorId}))
    const blocks = state.serverBlocks.map((block, i)=>merge(block, {
        editorId: `editor-${i}`,
        infoId: `info-${i}`,
    }))
    return {blocks}
}
// UI components
function nodesPerLine(o: Node): Array<Node> {
    // TODO: this should maybe also have a .indentI
    let i = -1
    const nodes: Array<Node> = []
    function getNewLineI(){
        i += 1
        return i
    }
    function inner(o: Node): void {
        if(is.multiple(o)) incrementLineIMap[o.type](o as NodeMultiple)  // TODO..
    }
    const incrementLineIMap: {[s: string]: (o: NodeMultiple)=>void} = {
        section: o=>o.value.forEach(o=>inner(o)),
        let: o=>{
            const lineI = getNewLineI()
            o.value.forEach(o=>inner(o))
            nodes.push({lineI, ...o})
            getNewLineI()
        },
        def: o=>{
            const lineI = getNewLineI()
            o.value.forEach(o=>inner(o))
            nodes.push({lineI, ...o})
            getNewLineI()
        },
        line: o=>{
            const lineI = getNewLineI()
            o.value.forEach(o=>inner(o))
            nodes.push({lineI, ...o})
        },
        aggregator: o=>o.value.forEach(o=>inner(o)),
        map_macro: o=>o.value.forEach(o=>inner(o)),
        named_value: o=>o.value.forEach(o=>inner(o)),
        set: o=>o.value.forEach(o=>inner(o)),
        relation_literal: o=>{
            const [headers, ...rows] = o.value
            const lineI = getNewLineI()
            nodes.push({lineI, ...o})
            if(rows.length > 0) getNewLineI()  // for ---------
            rows.forEach(getNewLineI)
        },
    }
    inner(o)
    return sortBy(o=>o.lineI, nodes).filter(o=>o.compiledType === 'headers')
}
const Header = (header: string)=>m('.button.button-outline.header.pre', header)
const ConnectingLine = ()=>m('svg.connecting-line', {width: INFO_ORIGINAL_GAP, height: 2 * SVG_OFFSET},
    m('marker#arrowhead', {refX: 5, refY: 5, markerWidth: 8, markerHeight: 8},
        m('circle[cx=5][cy=5][r=3]', {style: "stroke: none; fill:#000000;"})),
    m('line[marker-end=url(#arrowhead)][x1=0][x2=0]', {y1:SVG_OFFSET, y2: SVG_OFFSET, style: {stroke:'#000'}}))

const Info = (block: Block)=>
    block.astWithHeaders === null? null : m(
        '.source',
        {id: block.infoId, 'to-editor-id': block.editorId},
        nodesPerLine(block.astWithHeaders)
            .map(o=>m(
                '.compiled-line',
                {'to-line': o.lineI},
                o.compiledValue.map(v=>Header(v.value)),
                ConnectingLine(),
            )),
    )

const Original = (block: Block)=>m(
    '.source.right',
    {class: `language-${block.language}`},
    m('', {id: block.editorId, language: block.language}, block.source),
    m('.connecting-line'),
)

const View = ()=>m('.root',
    m('.options',
        m('button.button.button-small', 'some test case'),
        m('button.button.button-outline.button-small', 'another test case'),
        m('button.button', 'display provided env'),
    ),
    deriveState(state).blocks.map((block, i)=>
        m('.block',
            Info(block),
            Original(block)),
))

// stuff below operates outside of mithril rendering

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

function alignLines(){
    try{
        for(let infoId of deriveInfoIds(state)){
            const infoElement = document.getElementById(infoId)
            const toEditorElement = document.getElementById(infoElement.getAttribute('to-editor-id'))
            for(let fromElement of Array.from(infoElement.getElementsByClassName('compiled-line')) as Array<HTMLElement>){
                const lineElement = fromElement.getElementsByClassName('connecting-line')[0].children[1]
                const lineI = parseInt(fromElement.getAttribute('to-line'))
                const toElement = toEditorElement.getElementsByClassName('ace_line')[lineI]  as HTMLElement
                lineElement.setAttribute('x2', INFO_ORIGINAL_GAP.toString())
                lineElement.setAttribute('y1', (SVG_OFFSET + (fromElement.offsetHeight / 2)).toString())
                lineElement.setAttribute('y2', (
                    + 10
                    + SVG_OFFSET
                    - infoElement.offsetTop
                    - fromElement.offsetTop
                    + toEditorElement.parentElement.offsetTop
                    + toElement.offsetTop
                ).toString())
            }
        }
        return true
    }
    catch{
        return false
    }
}

async function init(){
    await m.mount(document.body, {view: View, onupdate: alignLines})

    // fetch data and redraw
    const serverBlocks = await readFromServer()
    setState({serverBlocks})
    m.redraw()

    // load editors and align lines for the first time
    const ids = deriveEditorIds(state)
    requestAnimationFrame(()=>loadEditors(ids))
    let editorsLoaded = false
    let id = setInterval(function(){
        if(editorsLoaded) return clearInterval(id)
        editorsLoaded = alignLines()
    }, 100)
    // re align lines on window resize
    window.addEventListener('resize', alignLines)
}

declare const underTest
try{underTest}
catch{init()}
export let test
