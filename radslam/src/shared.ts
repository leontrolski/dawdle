import {Node, NodeMultiple, parser, deMunge} from './parser'
import {compiler, emptyEnv} from './compiler'

export const DAWDLE_URL = 'http://localhost:3000/dawdle'

export type ServerBlock = {
    language: string,
    source: string,
    astWithHeaders: Node | null,
}

export let test
