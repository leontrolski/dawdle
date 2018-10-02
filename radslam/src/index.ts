import { default as axios } from 'axios'
import { zip, merge, isEmpty, range, uniq, difference } from 'ramda'
import * as m from 'mithril'
import * as ace from 'ace-builds/src-noconflict/ace'
import * as diff from 'diff'
ace.config.set('basePath', './modes/')

import { emptyEnv } from './compiler';
import { DAWDLE_URL, Setters, ServerState, State, DerivedState, UIState, emptyDawdleServerBlock } from './shared'
import { View, SVG_OFFSET } from './components'
import { networkInterfaces } from 'os';


export function mapOldLineToNew(old: string, new_: string): {[n: number]: number} {
    const lineDiff = diff.diffLines(old, new_, {ignoreCase: false, ignoreWhitespace: true})
    let i = 0
    let offset = 0
    const oldNewLineMap: {[n: number]: number} = {}
    for (let d of lineDiff){
        if(d.added){
            offset += d.count
        }
        else if(d.removed){
            offset -= d.count
            i += d.count
        }
        else{
            range(i, i + d.count).forEach(n=>oldNewLineMap[n] = n + offset)
            i += d.count
        }
    }
    return oldNewLineMap
}

// big closure to make functions that mutate state
function makeSetters(s: State): Setters {
    const setters: Setters = {
        path: function(path){s.path = path},
        defaultEnv: function(env){s.defaultEnv = env},
        blocks: function(blocks){s.blocks = blocks},
        editedSource: async function(i, editedSource){
            if(s.blocks[i].source.split('\n').length !== editedSource.split('\n').length){
                const oldNewLineMap = mapOldLineToNew(s.blocks[i].source, editedSource)
                s.ui.folded[i] = (s.ui.folded[i] || []).map(lineI=>oldNewLineMap[lineI]).filter(x=>x)
            }
            s.blocks[i].source = editedSource
        },
        httpError: function (errorMessage){s.ui.HTTPError = errorMessage},
        mouseovered: function(blockI, lineI){s.ui.mouseovered = {blockI, lineI}},
        fold: function(blockI, lineI){s.ui.folded[blockI] = uniq((s.ui.folded[blockI] || []).concat([lineI]))},
        unfold: function(blockI, lineI){s.ui.folded[blockI] = difference(s.ui.folded[blockI] || [], [lineI])},
        insertBlock: function(blockI, lineI){
            const block = s.blocks[blockI]
            const sourceLines = block.source.split('\n')
            const pre = sourceLines.slice(0, lineI + 1)
            const post = sourceLines.slice(lineI + 1)
            s.blocks[blockI] = {...block, ...{source: pre.join('\n')}}
            s.blocks.splice(blockI + 1, 0, emptyDawdleServerBlock)
            s.blocks.splice(blockI + 2, 0, {...block, ...{source: post.join('\n')}})
            // ensure folded lines remain folded
            const newFolded = {}
            for(let i in s.ui.folded){
                if(parseInt(i) > blockI) newFolded[parseInt(i) + 2] = s.ui.folded[i]
                else newFolded[i] = s.ui.folded[i]
            }
            s.ui.folded = newFolded
            // redraw, then reload the editors, then realign the lines
            m.redraw()
            loadEditors(setters, s)
            requestAnimationFrame(()=>alignLines(s))
        },
        emptyUI: function(){s.ui = makeEmptyUi()},
        storedUI: function(){
            const stored = localStorage.getItem(s.path)
            if(stored) s.ui = JSON.parse(stored).ui
        },
        // functions that interact with server
        fromServerState: async function(){
            const serverState = await setters.readServerState() as ServerState
            setters.path(serverState.path)
            setters.defaultEnv(serverState.defaultEnv)
            setters.blocks(serverState.blocks)
            setters.storedUI()
            if(!isEmpty(editors)) loadEditors(setters, s)
            m.redraw()
        },
        fromWriteServerState: async function(){
            const serverState = await setters.writeServerState() as ServerState
            // merge blocks only on new valid information
            const mergedBlocks = zip(s.blocks, serverState.blocks)
                .map(([original, server])=>merge(
                    server,
                    {
                        source: original.source,
                        astWithHeaders: server.astWithHeaders || original.astWithHeaders,
                    }))
            setters.defaultEnv(serverState.defaultEnv)
            setters.blocks(mergedBlocks)
            m.redraw()
        },
        // these don't actually mutate state
        readServerState: async function(){
            console.log('Reading file from server')
            const response = await catchHTTPErrors(setters, ()=>axios.get(DAWDLE_URL))
            return response.data
        },
        writeServerState: async function(){
            console.log('Getting server to compile')
            const response = await catchHTTPErrors(setters, ()=>axios.put(DAWDLE_URL, s))
            return response.data
        },
        saveStateToFile: async function(){
            console.log('Writing file to server')
            const response = await catchHTTPErrors(setters, ()=>axios.post(DAWDLE_URL, s))
            m.redraw()
        },
    }
    return setters
}
// munging functions
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
        blockI: i,
        id: `block-${i}`,
        editorId: `editor-${i}`,
        infoId: `info-${i}`,
        selectedTestCaseName: Object.keys(block.testCases)[0],
    }))
    return {
        defaultEnv: s.defaultEnv,
        ui: s.ui,
        blocks,
        areAnyErrors: s.blocks.map(block=>!isEmpty(block.errors)).some(x=>x)
    }
}
function makeEmptyUi(): UIState {
    return {
        HTTPError: null,
        mouseovered: {blockI: null, lineI: null},
        folded: {},
    }
}
import { Record } from 'immutable'
async function init(){
    // empty to start with
    let state = State()

    const setters = makeSetters(state)
    // mount the root component
    await m.mount(document.body, {
        view: ()=>View(setters, deriveState(state)),
        onupdate: ()=>{
            alignLines(state)
            localStorage.setItem(state.path, JSON.stringify({ui: state.ui}))
        },
    })
    // fetch data and redraw
    await setters.fromServerState()
    // load editors and align lines for the first time
    loadEditors(setters, state)
    requestAnimationFrame(()=>alignLines(state))
    // inspecting tool and realign lines on resize
    const _window = window as any
    _window._state = state
    _window._deriveState = deriveState
    _window.addEventListener('resize', ()=>requestAnimationFrame(()=>alignLines(_window._state)))
}

// stuff below operates outside of mithril rendering, scary stuff
type Ace = AceAjax.Editor & {renderer: {$cursorLayer: any}}
let editors: Ace[] = []
function loadEditors(setters: Setters, s: State){
    const ids = deriveEditorIds(s)
    editors.forEach(editor=>editor.destroy())
    editors = []
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
    editors.forEach((editor, i)=>{
        editor.setValue(s.blocks[i].source)
        editor.clearSelection()
        const debouncedWrite = debounce(async function(){
            setters.editedSource(i, editor.getValue())
            await setters.fromWriteServerState()
        }, 500)
        editor.on('change', ()=>debouncedWrite())
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
function alignLines(s: State){
    try{
        for(let infoId of deriveInfoIds(s)){
            const infoElement = document.getElementById(infoId)
            const toEditorElement = document.getElementById(infoElement.getAttribute('to-editor-id'))
            for(let fromElement of Array.from(infoElement.getElementsByClassName('compiled-line')) as Array<HTMLElement>){
                const lineElement = fromElement.getElementsByClassName('actual-line')[0]
                const lineI = parseInt(fromElement.getAttribute('to-line'))
                const toElement = toEditorElement.getElementsByClassName('ace_line')[lineI]  as HTMLElement
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
		var later = function(){
			timeout = null
			func(...args)
		}
		clearTimeout(timeout)
		timeout = setTimeout(later, wait)
	}
}
async function catchHTTPErrors(setters: Setters, f: Function){
    try {
        return await f()
    }
    catch(error){
        if(error.response){
            const el = document.createElement('html')
            el.innerHTML = error.response.data
            const HTTPError = `Server responded with status: ${error.response.status}: ${el.innerText}`
            setters.httpError(HTTPError)
            m.redraw()
            return
        }
        else{
            throw error
        }
    }
}

// run when not under test
declare const underTest: any
try{underTest}
catch{init()}
export let test: any = null
