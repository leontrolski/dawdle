import {Node, NodeMultiple, parser, deMunge} from './parser'
import {compiler, emptyEnv} from './compiler'

export const languages = {
    dawdle: 'dawdle',
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
}

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

let foo:
    def Identity relation:
        relation:

    | :a | :b |
    -----------
    | 6  | 8  |
    Identity

| :a | :b |
-----------
| 1  | 5  |
U foo:
JoinClone
    | :a | :c |
`
const ast = deMunge(parser(dawdleSource2)) as NodeMultiple

const pythonSource3 = `)`

const dawdleInfo1 = `some
-------
foo
bar`

export type ServerBlock = {
    language: string,
    source: string,
    astWithHeaders: Node | null,
}
export const serverBlocks: Array<ServerBlock> = [
    {language: 'python', source: pythonSource1, astWithHeaders: null},
    {language: 'dawdle', source: dawdleSource1, astWithHeaders: null},
    {language: 'python', source: pythonSource2, astWithHeaders: null},
    {language: 'dawdle', source: dawdleSource2, astWithHeaders: compiler(emptyEnv, ast)},
    {language: 'python', source: pythonSource3, astWithHeaders: null},
]
const fileState = {source: ''}
const serverAst = {}

export let test
