import {Node, Section, parser, deMunge} from './parser'
import {Env, compiler, emptyEnv} from './compiler'

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
