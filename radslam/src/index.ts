import { foo, bar } from './server'
import { zip } from 'ramda'
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
const allSource = [
    [pythonSource1, ''],
    [dawdleSource1, dawdleInfo1],
    [pythonSource2, ''],
    [dawdleSource2, ''],
    [pythonSource3, ''],
]
type State = {allSource: Array<Array<string>>}
const state: State = {allSource}

const OriginalBlock = (source: string, i: number)=>m(
    '.source.pre.left',
    m('', {id: `editor-${i}`},
    source))
const DawdleBlock = OriginalBlock

const InfoBlock = (info: string)=>m('.source.pre.right', info)

type DerivedState = State
function deriveState(state: State): DerivedState{
    return state
}

const View = ()=>m('div',
    allSource.map(([source, info], i)=>
        m('.block',
            OriginalBlock(source, i),
            InfoBlock(info)),
))

m.mount(document.body, {view: View})

const editor = ace.edit("editor-0", {
    showGutter: false,
    showPrintMargin: false,
    maxLines: Infinity,
})

