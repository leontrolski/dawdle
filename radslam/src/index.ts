import { foo, bar } from './server'
import { zip } from 'ramda'
import * as m from 'mithril'

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

// const OriginalBlock = (source: string)=>m('.source.pre.left', source)
const OriginalBlock = (source: string)=>m('.source.pre.left', source, m('.cursor', ''))
const DawdleBlock = OriginalBlock

const InfoBlock = (info: string)=>m('.source.pre.right', info)

const View = ()=>m('div', allSource.map(([source, info])=>
    m('.block',
        OriginalBlock(source),
        InfoBlock(info))))

m.mount(document.body, {view: View})
