import { Node, NodeMultiple, Section, Decimal, Datetime, is } from './parser'
import { Env } from './compiler'
import { sortBy } from 'ramda'

export const DAWDLE_URL = 'http://localhost:3000/dawdle'

// API types
export type FileBlock = {
    language: string
    source: string
    commentData?: CommentData
}
export type FileState = {
    header: any
    blocks: FileBlock[]
    defaultEnv: Env
}
export type DawdleModule = {
    defaultEnv: Env
}
export type CommentData = {
    dawdle?: any
    type: 'header'
    originalLanguage: string
    command: string
} | null
export type RelationAPI = {
    headers: string[]
    rows: Array<(number | string | boolean | null | Decimal | Datetime)[]>  // TODO: make this Iterable
    // TODO: implement these extra bits
    types?: string[]
    indexes?: any[]
    ranks?: any[]
}
export type FunctionAPI = {
    name: string
    type: 'extend' | 'filter' | 'aggregate'
    function: (rel: RelationAPI, ...args: any[])=>RelationAPI
    args: any
}
export type ServerError = {
    lineNumber: number | null
    message: string
}
export type TestCaseMap = {
    [name: string]: Env
}
export type ServerBlock = {
    id: string
    language: string
    source: string
    astWithHeaders: Section | null
    testCases: TestCaseMap
    errors: ServerError[]
    commentData?: CommentData
}
export type ServerState = {
    defaultEnv: Env
    blocks: ServerBlock[]
}
// UI types
export type UIState = {
    HTTPError: string | null
    mouseovered: {blockI: number | null, lineI: number | null}
    folded: {[blockI: number]: number[]}
}
export type State = ServerState & {
    ui: UIState
}
export type Block = ServerBlock & {
    blockI: number
    editorId: string
    infoId: string
    selectedTestCaseName: string
}
export type DerivedState = {
    defaultEnv: Env
    blocks: Block[]
    ui: UIState
    areAnyErrors: boolean
}
export type Setters = {
    defaultEnv: (env: Env)=>void
    blocks: (blocks: ServerBlock[])=>void
    editedSource: (i: number, editedSource: string)=>Promise<void>
    httpError: (errorMessage: string | null)=>void
    mouseovered: (blockI: number, lineI: number)=>void
    fold: (blockI: number, lineI: number)=>void
    unfold: (blockI: number, lineI: number)=>void
    emptyUI: ()=>void
    fromServerState: ()=>Promise<void>
    fromWriteServerState: ()=>Promise<void>
    readServerState: ()=>Promise<State>
    writeServerState: ()=>Promise<State>
    saveStateToFile: ()=>Promise<void>
}


// stuff below shouldn't necessarily be here..
export type Spacer = {
    compiledType: 'spacer'
    lineI: number
}
export function isSpacer(o: Node | Spacer): o is Spacer {
    return (<Spacer>o).compiledType === 'spacer'
}
export type CompiledLineNode = (Node & {lineHash?: string}) | Spacer

export function nodesPerLine(o: Node): CompiledLineNode[] {
    // TODO: this should maybe also have a .indentI
    let i = -1
    const nodes: CompiledLineNode[] = []
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
            nodes.push({compiledType: 'spacer', lineI: getNewLineI()})
        },
        def: o=>{
            const lineI = getNewLineI()
            o.value.forEach(o=>inner(o))
            nodes.push({compiledType: 'spacer', lineI: getNewLineI()})
        },
        line: o=>{
            const lineI = getNewLineI()
            o.value.forEach(o=>inner(o))
            nodes.push({lineI, ...o})
        },
        aggregator: o=>{
            const lineI = getNewLineI()
            o.value.forEach(o=>inner(o))
        },
        map_macro: o=>{
            const lineI = getNewLineI()
            o.value.forEach(o=>inner(o))
        },
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