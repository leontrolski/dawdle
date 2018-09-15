import { zip, merge, last, transpose, repeat, intersperse, sortBy } from 'ramda'
import * as m from 'mithril'
import * as ace from 'ace-builds/src-noconflict/ace'
ace.config.set('basePath', './')

import { ServerBlock, serverBlocks, languages } from './server'
import { Node, NodeMultiple, is } from './parser'

// constants that map to css
const SVG_OFFSET = 1000
const INFO_ORIGINAL_GAP = 50

// server
function readFromServer(): Promise<State>{
    return new Promise((resolve, reject)=>resolve({serverBlocks}))//, serverAst})
    // actually f(fileState.source)
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
    let i = -1
    const nodes: Array<Node> = []
    function getNewLineI(){
        i += 1
        return i
    }
    function inner(o: Node): void {
        if(is.multiple(o)) typeStringMap[o.type](o)
    }
    const typeStringMap: {[s: string]: (o: NodeMultiple)=>void} = {
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

const Info = (block: Block)=>
    block.astWithHeaders === null? null : m(
        '.source',
        {id: block.infoId, 'to-editor-id': block.editorId},
        nodesPerLine(block.astWithHeaders)
            .map(o=>m(
                'p.compiled-line',
                {'to-line': o.lineI},
                o.lineI,
                o.compiledValue.map(v=>v.value),
                ' ',
                o.type,
                ' ',
                JSON.stringify(o.value),
                m('svg.connecting-line', {width: INFO_ORIGINAL_GAP, height: 2 * SVG_OFFSET},
                    m('line', {x1: 0, y1:SVG_OFFSET, x2: 0, y2: SVG_OFFSET, style: {stroke:' #000'}})),
            )),
    )

const Original = (block: Block)=>m(
    '.source.right',
    {class: block.language === languages.dawdle? 'language-dawdle' : ''},
    m('', {id: block.editorId, language: block.language}, block.source),
    m('.connecting-line'),
)

const View = ()=>m('.root',
    m('.options',
        m('button.button.button-small', 'some test case'),
        m('button.button.button-outline.button-small', 'another test case'),
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
    for(let infoId of deriveInfoIds(state)){
        const infoElement = document.getElementById(infoId)
        const toEditorElement = document.getElementById(infoElement.getAttribute('to-editor-id'))
        for(let fromElement of Array.from(infoElement.getElementsByClassName('compiled-line')) as Array<HTMLElement>){
            const lineElement = fromElement.getElementsByClassName('connecting-line')[0].children[0]
            const lineI = parseInt(fromElement.getAttribute('to-line'))
            const toElement = toEditorElement.getElementsByClassName('ace_line')[lineI]  as HTMLElement
            lineElement.setAttribute('x2', INFO_ORIGINAL_GAP.toString())
            lineElement.setAttribute('y1', (SVG_OFFSET + (fromElement.offsetHeight / 2)).toString())
            lineElement.setAttribute('y2', (
                6 +
                SVG_OFFSET +
                toElement.offsetTop -
                fromElement.offsetTop +
                toEditorElement.parentElement.offsetTop -
                infoElement.offsetTop
            ).toString())
        }
    }
}

async function init(){
    m.mount(document.body, {view: View})
    const newState = await readFromServer()
    setState(newState)
    await m.redraw()
    const ids = deriveEditorIds(state)
    requestAnimationFrame(()=>loadEditors(ids))
    let editorsLoaded = false
    let id = setInterval(function(){
        if(editorsLoaded) return clearInterval(id)
        try{alignLines(); editorsLoaded = true}
        catch{}
    }, 100)
}
init()

export let test
