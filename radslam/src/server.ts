import {parser, deMunge} from './parser'
import {compiler, emptyEnv} from './compiler'

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
    | :a | :c |
`
const ast = deMunge(parser(dawdleSource2))

const pythonSource3 = `)`

const dawdleInfo1 = `some
-------
foo
bar`

export type ServerBlock = {
    language: string,
    source: string,
    astWithHeaders: string,
}
export const serverBlocks: Array<ServerBlock> = [
    {language: 'python', source: pythonSource1, astWithHeaders: ''},
    {language: 'dawdle', source: dawdleSource1, astWithHeaders: ''},
    {language: 'python', source: pythonSource2, astWithHeaders: ''},
    {language: 'dawdle', source: dawdleSource2, astWithHeaders: compiler(emptyEnv, ast)},
    {language: 'python', source: pythonSource3, astWithHeaders: ''},
]
const fileState = {source: ''}
const serverAst = {}
