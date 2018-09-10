import { foo, bar } from './server'
import { zip, merge } from 'ramda'
import * as m from 'mithril'
import * as ace from 'ace-builds/src-noconflict/ace'

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
const dawdleSource2 = `table:
> value true`
const pythonSource3 = `)`
const dawdleInfo1 = `some
-------
foo
bar`
const serverBlocks = [
    {type: 'original', source: pythonSource1, info: ''},
    {type: 'dawdle', source: dawdleSource1, info: dawdleInfo1},
    {type: 'original', source: pythonSource2, info: ''},
    {type: 'dawdle', source: dawdleSource2, info: ''},
    {type: 'original', source: pythonSource3, info: ''},
]

type ServerBlock = {
    type: string,
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
function sleep<T>(x: T): Promise<T>{
    return new Promise(resolve=>setTimeout(()=>resolve(x), 1000))
}

// empty state to start with
let state: State = {
    serverBlocks: []
}
function setState(s: State): void{state = s}

// deriving functions
function deriveIds(state: State): Array<string>{
    return state.serverBlocks.map((block, i)=>`editor-${block.type}-${i}`)
}
function deriveState(state: State): DerivedState{
    const ids = deriveIds(state).map(id=>({id}))
    const blocks = zip(state.serverBlocks, ids).map(([a, b])=>merge(a, b))
    return {blocks}
}
// UI components
const OriginalBlock = (block: Block)=>m(
    '.source.pre.left',
    m('', {id: block.id},
    block.source))
const DawdleBlock = OriginalBlock

const InfoBlock = (info: string)=>m('.source.pre.right', info)

const View = ()=>m('div',
    deriveState(state).blocks.map((block, i)=>
        m('.block',
            OriginalBlock(block),
            InfoBlock(block.info)),
))

m.mount(document.body, {view: View})

function loadEditors(ids: Array<string>): Array<AceAjax.Editor>{
    return ids.map(id =>
        ace.edit(id, {
            showGutter: false,
            showPrintMargin: false,
            // highlightActiveLine: false,
            maxLines: Infinity,
        })
    )
}

async function init(){
    const newState = await serverRead()
    setState(newState)
    m.redraw()
    let editors: Array<AceAjax.Editor> = []
    await requestAnimationFrame(()=>{window.editors = loadEditors(deriveIds(newState))})
}
init()
