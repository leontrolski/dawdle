import { default as axios } from 'axios'
import { zip, merge, sortBy } from 'ramda'
import * as m from 'mithril'
import * as ace from 'ace-builds/src-noconflict/ace'
ace.config.set('basePath', './modes/')

import { DAWDLE_URL, ServerBlock, State } from './shared'
import { Node, NodeMultiple, Header, is, Set } from './parser'
import { Env, emptyEnv } from './compiler';

// TODO:
// - sort out editor/source/original naming inconsistencies

// constants that map to css
const SVG_OFFSET = 1000
const INFO_ORIGINAL_GAP = 50

// derived
type Block = ServerBlock & {
    editorId: string,
    infoId: string,
    selectedTestCaseName: string,
}
type DerivedState = {
    blocks: Block[],
}

// empty state to start with
let state: State = {
    defaultEnv: emptyEnv,
    blocks: [],
}
// functions that mutate state
function setState(s: State): void {
    state = s
}
async function setEditedSource(i: number, editedSource: string): Promise<void> {
    state.blocks[i].source = editedSource
    await setFromWriteServerStateDebounced()
}

// server
async function readServerState(): Promise<State> {
    const response = await axios.get(DAWDLE_URL)
    return response.data
}
async function writeServerState(): Promise<State> {
    const response = await axios.post(DAWDLE_URL, state)
    return response.data
}
async function setFromServerState(): Promise<void> {
    const serverState = await readServerState()
    setState({
        defaultEnv: serverState.defaultEnv,
        blocks: serverState.blocks,
    })
}
async function setFromWriteServerState(){
    const serverState = await writeServerState()
    setState({
        defaultEnv: serverState.defaultEnv,
        blocks: serverState.blocks,
    })
}
const setFromWriteServerStateDebounced = debounce(setFromWriteServerState, 500)

// deriving functions
function deriveEditorIds(state: State): Array<string> {
    return state.blocks.map((_, i)=>`editor-${i}`)
}
function deriveInfoIds(state: State): Array<string> {
    return state.blocks
        .map((block, i)=>({block, id: `info-${i}`}))
        .filter(both=>both.block.astWithHeaders)
        .map(both=>both.id)
}
function deriveState(state: State): DerivedState {
    const blocks = state.blocks.map((block, i)=>merge(block, {
        editorId: `editor-${i}`,
        infoId: `info-${i}`,
        selectedTestCaseName: Object.keys(block.testCases)[0],
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
    return sortBy(o=>o.lineI, nodes)
}

const ConnectingLine = ()=>m('svg.connecting-line', {width: INFO_ORIGINAL_GAP, height: 2 * SVG_OFFSET},
    m('marker#arrowhead', {refX: 5, refY: 5, markerWidth: 8, markerHeight: 8},
        m('circle[cx=5][cy=5][r=3]', {style: "stroke: none; fill:#000000;"})),
    m('line[marker-end=url(#arrowhead)][x1=0][x2=0]', {y1:SVG_OFFSET, y2: SVG_OFFSET, style: {stroke:'#000'}}))

const CompiledValue = (o: Node)=>{
    if(o.compiledType === 'headers') return o.compiledValue.map((v: Header)=>m('.button.button-outline.header.pre', v.value))
    if(o.compiledType === 'set') return ['[', o.compiledValue.map((v: Set)=>v.value).join(', '), ']']
    return null
}

const Info = (block: Block)=>
    block.astWithHeaders === null? null : m(
        '.source',
        {id: block.infoId, 'to-editor-id': block.editorId},
        m('.test-case-options', Object.keys(block.testCases).map(testCaseName=>
            m(
                'button.button.button-small',
                {class: testCaseName === block.selectedTestCaseName? '' : 'button-outline'},
                testCaseName
            ))),
        nodesPerLine(block.astWithHeaders)
            .filter(o=>o.compiledType)
            .map(o=>m(
                '.compiled-line',
                {'to-line': o.lineI},
                CompiledValue(o),
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
        m('button.button', 'Default env'),
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
    zip(editors, ids).forEach(([editor, id], i)=>{
        editor.on('change', ()=>setEditedSource(i, editor.getValue()))
        // only highlight lines of the focused editor
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
function debounce(func: Function, wait: number){
	let timeout: NodeJS.Timer
	return function(...args: any[]){
		var later = function() {
			timeout = null
			func(args)
		}
		clearTimeout(timeout)
		timeout = setTimeout(later, wait)
	}
}

async function init(){
    await m.mount(document.body, {view: View, onupdate: alignLines})

    // fetch data and redraw
    await setFromServerState()
    m.redraw()

    // load editors and align lines for the first time
    const ids = deriveEditorIds(state)
    requestAnimationFrame(()=>loadEditors(ids))
    let editorsLoaded = false
    let id: NodeJS.Timer = setInterval(function(){
        if(editorsLoaded) return clearInterval(id)
        editorsLoaded = alignLines()
    }, 100)
    // re align lines on window resize
    window.addEventListener('resize', alignLines)
}


// inspecting tools
const _window = window as any
_window._state = ()=>state  // allow easy inspecting
// run when not under test
declare const underTest: any
try{underTest}
catch{init()}
export let test: any
