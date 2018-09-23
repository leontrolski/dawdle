import {Node, NodeMultiple, Section, is} from './parser'
import {Env, compiler, emptyEnv} from './compiler'
import { sortBy } from 'ramda';

export const DAWDLE_URL = 'http://localhost:3000/dawdle'

export type ServerError = {
    lineNumber: number | null,
    message: string,
}

export type TestCaseMap = {[name: string]: Env}

export type CommentData = {
    dawdle?: any,
    type: 'header',
    originalLanguage: string,
    command: string,
} | null

export type ServerBlock = {
    id: string,
    language: string,
    source: string,
    astWithHeaders: Section | null,
    testCases: TestCaseMap,
    errors: ServerError[],
    commentData?: CommentData,
}

export type ServerState = {
    defaultEnv: Env,
    blocks: ServerBlock[],
}

// stuff below shouldn't necessarily be here..

export type Spacer = {
    compiledType: 'spacer',
    lineI: number,
}
export function isSpacer(o: Node | Spacer): o is Spacer {
    return (<Spacer>o).compiledType === 'spacer'
}

export function nodesPerLine(o: Node): (Node | Spacer)[] {
    // TODO: this should maybe also have a .indentI
    let i = -1
    const nodes: (Node | Spacer)[] = []
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
            nodes.push({lineI, ...o})
            nodes.push({compiledType: 'spacer', lineI: getNewLineI()})
        },
        def: o=>{
            const lineI = getNewLineI()
            o.value.forEach(o=>inner(o))
            nodes.push({lineI, ...o})
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
            // nodes.push({lineI, ...o})
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