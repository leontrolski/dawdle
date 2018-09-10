import { foo, bar } from './server'
import { zip, merge } from 'ramda'
import * as m from 'mithril'
import * as ace from 'ace-builds/src-noconflict/ace'
ace.config.set('basePath', './')


const pythonSource1 = `import foo

d = [1, 2, 3]

while len(d) > 100:
    pass

01234567890123456789012345678901234567890123456789012345678901234567890123456789
1         2         3         4         5         6         7         8

ast = (`
const dawdleSource1 = `table:
J another:`
const pythonSource2 = `)

and_then = (`
const dawdleSource2 = `def JoinClone relation: right:
    relation:
    J right:

| :a | :b |
JoinClone
    | :a | :c |`
const pythonSource3 = `)`
const dawdleInfo1 = `some
-------
foo
bar`
const serverBlocks = [
    {language: 'python', source: pythonSource1, info: ''},
    {language: 'dawdle', source: dawdleSource1, info: dawdleInfo1},
    {language: 'python', source: pythonSource2, info: ''},
    {language: 'dawdle', source: dawdleSource2, info: ''},
    {language: 'python', source: pythonSource3, info: ''},
]

type ServerBlock = {
    language: string,
    source: string,
    info: string,
}
type Block = ServerBlock & {id: string}

type State = {
    serverBlocks: Array<ServerBlock>
}
type DerivedState = {
    blocks: Array<Block>
}


// server
const fileState = {source: ''}
const serverAst = {}
function serverRead(): Promise<State>{
    return new Promise((resolve, reject)=>resolve({serverBlocks}))//, serverAst})
    // actually f(fileState.source)
}
function serverWrite(){}// f(fileState.source)}

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
const OriginalBlock = (block: Block)=>m(
    '.source.left', m('', {id: block.id, language: block.language}, block.source))

const InfoBlock = (info: string)=>m('.source.pre.right', info)

const View = ()=>m('div',
    deriveState(state).blocks.map((block, i)=>
        m('.block',
            OriginalBlock(block),
            InfoBlock(block.info)),
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
    const newState = await serverRead()
    setState(newState)
    m.redraw()
    const ids = deriveIds(state)
    await requestAnimationFrame(()=>loadEditors(ids))
}
init()
