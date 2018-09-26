import { default as axios } from 'axios'
import { zip, merge, isEmpty, intersperse, isNil } from 'ramda'
import * as m from 'mithril'
import * as ace from 'ace-builds/src-noconflict/ace'
ace.config.set('basePath', './modes/')

import { Node, Header, is, Set, Value } from './parser'
import { Env, emptyEnv } from './compiler';
import { DAWDLE_URL, ServerBlock, ServerState, nodesPerLine, isSpacer, RelationAPI } from './shared'

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

type UIState = {
    HTTPError: string | null,
}
type State = ServerState & {
    ui: UIState,
}
// empty to start with
let state: State = {
    defaultEnv: emptyEnv,
    blocks: [],
    ui: {HTTPError: null},
}
// functions that mutate
function setDefaultEnv(s: State, env: Env){
    s.defaultEnv = env
}
function setBlocks(s:State, blocks: ServerBlock[]){
    s.blocks = blocks
}
async function setEditedSource(s: State, i: number, editedSource: string): Promise<void> {
    s.blocks[i].source = editedSource
    await setFromWriteServerStateDebounced(s)
}
function setHttpError(s:State, errorMessage: string | null){
    s.ui.HTTPError = errorMessage
}

// server
async function readServerState(s: State): Promise<State> {
    console.log('Getting state from file')
    const response = await catchHTTPErrors(s, ()=>axios.get(DAWDLE_URL))
    return response.data
}
async function writeServerState(s: State): Promise<State> {
    console.log('Getting server to compile')
    const response = await catchHTTPErrors(s, ()=>axios.put(DAWDLE_URL, s))
    return response.data
}
async function saveStateToFile(s: State): Promise<void> {
    console.log('Saving state to file')
    const response = await catchHTTPErrors(s, ()=>axios.post(DAWDLE_URL, s))
    m.redraw()
}
async function setFromServerState(s: State): Promise<void> {
    const serverState = await readServerState(s)
    setDefaultEnv(s, serverState.defaultEnv)
    setBlocks(s, serverState.blocks)
    if(!isEmpty(editors)) setEditorsContent(s)  // yughh
    m.redraw()
}
async function setFromWriteServerState(s: State){
    const serverState = await writeServerState(s)
    // merge blocks only on new valid information
    const mergedBlocks = zip(s.blocks, serverState.blocks)
        .map(([original, server])=>merge(
            server,
            {
                source: original.source,
                astWithHeaders: server.astWithHeaders || original.astWithHeaders,
            }))
    setDefaultEnv(s, serverState.defaultEnv)
    setBlocks(s, mergedBlocks)
    m.redraw()
}
const setFromWriteServerStateDebounced = debounce(setFromWriteServerState, 500)

// deriving functions
function deriveEditorIds(s: State): Array<string> {
    return s.blocks.map((_, i)=>`editor-${i}`)
}
function deriveInfoIds(s: State): Array<string> {
    return s.blocks
        .map((block, i)=>({block, id: `info-${i}`}))
        .filter(both=>both.block.astWithHeaders)
        .map(both=>both.id)
}
function deriveState(s: State): DerivedState {
    const blocks = s.blocks.map((block, i)=>merge(block, {
        editorId: `editor-${i}`,
        infoId: `info-${i}`,
        selectedTestCaseName: Object.keys(block.testCases)[0],
    }))
    return {blocks}
}
function deriveAreAnyErrors(s: State): boolean {
    return s.blocks.map(block=>!isEmpty(block.errors)).some(x=>x)
}

// UI components

const ConnectingLine = ()=>m('svg.connecting-line', {width: INFO_ORIGINAL_GAP, height: 2 * SVG_OFFSET},
    m('marker#arrowhead', {refX: 5, refY: 5, markerWidth: 8, markerHeight: 8},
        m('circle[cx=5][cy=5][r=3]', {style: {stroke: 'none', fill: 'black'}})),
    m('line[marker-end=url(#arrowhead)][x1=0][x2=0]', {y1: SVG_OFFSET, y2: SVG_OFFSET, style: {stroke: 'black'}}))

const HeaderEl = (headerValue: string)=>m('.button.button-outline.header.pre', headerValue)

// TODO: convert these to {type: value:} and make a component for each type
const Null = m('em.null', 'null')
const Cell = (cellValue)=>m('td.cell', isNil(cellValue)? Null : cellValue.type? cellValue.value : cellValue)

const Table = (o: RelationAPI)=>m('table.table',
    isEmpty(o.headers)?
        m('thead', m('th.cell', m('em', 'no headers')))
        : m('thead', m('tr', o.headers.map(header=>m('th.cell', HeaderEl(header))))),
    m('tbody', o.rows.map(row=>m('tr', row.map(Cell)))))

const CompiledValue = (o: Node)=>{
    if(o.compiledType === 'headers') return o.compiledValue.map(header=>HeaderEl(header.value))
    if(o.compiledType === 'set') return [
        '[',
        intersperse(', ', o.compiledValue.map((v: Value)=>is.header(v)? HeaderEl(v.value) : v.value)),
        ']'
    ]
    if(o.compiledType === 'relation') return Table(o.compiledValue as RelationAPI)
    return null
}

const Errors = (block: Block)=>m(
        '.source',
        block.errors.map(error=>m('.pre.error', error.message)))

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
            .map(o=>
                isSpacer(o)? m('.spacer')
                : m(
                    '.compiled-line',
                    {'to-line': o.lineI},
                    CompiledValue(o),
                    ConnectingLine())
            ),
    )

const Original = (block: Block)=>m(
    '.source.right',
    {class: `language-${block.language}`},
    m('', {id: block.editorId, language: block.language}, block.source),
)

const View = (s: State)=>m('.root',
    m('.options', ''),
    deriveState(s).blocks.map((block, i)=>
        m('.block',
            isEmpty(block.errors)? Info(block) : Errors(block),
            Original(block))),
    m('.editor-buttons',
        m('.button.button-editor.button-save', {
            onclick: deriveAreAnyErrors(s)? (): null=>null : ()=>saveStateToFile(s),
            class: deriveAreAnyErrors(s)? 'button-cant-save' : '',
            title: deriveAreAnyErrors(s)? "Can't save as there are errors" : '',
        }, 'save'),
        m('.button.button-editor.button-reload', {
            onclick: ()=>setFromServerState(s),
        }, 'reload from file'),
        m('.button.button-editor', 'show default env')),
    s.ui.HTTPError?
        m('.http-error.pre', s.ui.HTTPError,
            m('.editor-buttons', m('.button', {
                onclick: ()=>setHttpError(s, null),
            }, 'dismiss'))):
        null,
)

async function init(){
    await m.mount(document.body, {view: ()=>View(state), onupdate: alignLines})

    // fetch data and redraw
    await setFromServerState(state)

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

// stuff below operates outside of mithril rendering
let editors: any[] = [] //  should be AceAjax.Editor[] = []
function loadEditors(ids: Array<string>){
    editors = ids.map(id=>{
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
        editor.on('change', ()=>setEditedSource(state, i, editor.getValue()))
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
        (editor.container.children[0] as HTMLElement).onfocus = setHighlight
    })
}
function setEditorsContent(s: State){
    console.log('Setting editor content')
    zip(s.blocks, editors).forEach(([block, editor])=>editor.setValue(block.source))
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
                    + 13
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

// helpers
function debounce(func: Function, wait: number){
	let timeout: NodeJS.Timer
	return function(...args: any[]){
		var later = function() {
			timeout = null
			func(...args)
		}
		clearTimeout(timeout)
		timeout = setTimeout(later, wait)
	}
}
async function catchHTTPErrors(s: State, f: Function){
    try {
        return await f()
    }
    catch(error){
        if(error.response){
            const el = document.createElement('html')
            el.innerHTML = error.response.data
            const HTTPError = `Server responded with status: ${error.response.status}: ${el.innerText}`
            setHttpError(s, HTTPError)
            return
        }
        else{
            throw error
        }
    }
}

// inspecting tools
const _window = window as any
_window._state = state
// run when not under test
declare const underTest: any
try{underTest}
catch{init()}
export let test: any
