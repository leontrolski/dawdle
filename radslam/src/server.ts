import * as fs from 'fs'
import * as path from 'path'
import { zip } from 'ramda'
import * as express from 'express'
import * as bodyParser from 'body-parser'

import { ServerBlock, State, TestCaseMap, ServerError } from './shared'
import { Section, deMunge, parser } from './parser'
import { compiler, emptyEnv } from './compiler'
import { astToString, nodeToString } from './astToString'
import { log } from './errorsAndAsserters';

const PATH = path.resolve(__dirname, '../examples/example_1.ts')

type Header = {
    dawdle?: any,
    type: 'header',
    originalLanguage: string,
    command: string,
} | null

type PreBlock = {
    language: string,
    source: string,
}

const DAWDLE_COMMENT = '// {"dawdle":'
const comment_types = {
    header: 'header',
    begin: 'begin',
    end: 'end',
}
function parseComment(line: string){
    const data = JSON.parse(line.slice(3))
    return {type: data.dawdle, ...data}
}

const fakeTestCases: TestCaseMap = {
    'a test case': emptyEnv,
    'another test case': emptyEnv,
}

function readFile(p: string): Array<PreBlock>{
    let header: Header = null
    let isInDawdleBlock = false
    let thisOriginalBlock: Array<string> = []
    let thisDawdleBlock: Array<string> = []
    const serverBlocks: Array<PreBlock> = []

    const data = fs.readFileSync(p, 'utf8')
    for(let line of data.split('\n')){
        if(line.startsWith(DAWDLE_COMMENT)){
            const data = parseComment(line)
            if(data.type === comment_types.header){
                header = data as Header
            }
            if(!header) throw new Error('dawdle comment found in file without header comment')
            if(data.type === comment_types.begin){
                if(isInDawdleBlock) throw new Error('nested dawdle blocks are not supported')
                isInDawdleBlock = true
                serverBlocks.push({
                    language: header.originalLanguage,
                    source: thisOriginalBlock.join('\n'),
                })
                thisOriginalBlock = []
            }
            if(data.type === comment_types.end){
                isInDawdleBlock = false
                serverBlocks.push({
                    language: 'dawdle',
                    source: thisDawdleBlock.join('\n'),
                })
                thisDawdleBlock = []
            }
        }
        else{
            if(!isInDawdleBlock) thisOriginalBlock.push(line)
            else thisDawdleBlock.push(line)
        }
    }
    // and the final block
    serverBlocks.push({
        language: header.originalLanguage,
        source: thisOriginalBlock.join('\n'),
    })
    return serverBlocks
}

function astToSourceAndCompiled(blocks: PreBlock[]): ServerBlock[] {
    return blocks.map((block, i)=>{
        if(block.language !== 'dawdle'){
            return {
                id: `block-${i}`,
                language: block.language,
                source: block.source,
                astWithHeaders: null,
                testCases: {},
                errors: [],
            }
        }
        // else is a dawdle block
        const astMinimal = JSON.parse(block.source)
        const dawdleSource = astToString(astMinimal)
        const ast = deMunge(astMinimal)
        const astWithHeaders = compiler(emptyEnv, ast as Section)
        return {
            id: `block-${i}`,
            language: block.language,
            source: dawdleSource,
            astWithHeaders: astWithHeaders,
            // testCases: {},
            testCases: dawdleSource.includes('JoinClone')? fakeTestCases : {},
            errors: [],
        }
    })
}
function editedSourceToAstAndBack(
    originalBlocks: ServerBlock[],
    editedBlocks: ServerBlock[],
): ServerBlock[] {
    return zip(originalBlocks, editedBlocks).map(([original, edited])=>{
        if(edited.language !== 'dawdle') return edited
        // else is a dawdle block
        let dawdleSource, astWithHeaders
        let errors: ServerError[] = []
        const editedDawdleSource = edited.source.trim() + '\n'  // TODO: sort out this ambiguity?
        try{
            const astMinimal = parser(editedDawdleSource)
            dawdleSource = astToString(astMinimal)
            const ast = deMunge(astMinimal)
            astWithHeaders = compiler(emptyEnv, ast as Section)
        }
        catch(error){
            errors = [{message: error.message, lineNumber: null}]
            dawdleSource = original.source
            astWithHeaders = original.astWithHeaders
        }
        return {
            id: edited.id,
            language: edited.language,
            source: dawdleSource,  // this should not be used
            astWithHeaders: astWithHeaders,
            // testCases: {},
            testCases: dawdleSource.includes('JoinClone')? fakeTestCases : {},
            errors: errors,
        }
    })
}

function get(req: express.Request): State {
    return {
        defaultEnv: emptyEnv,
        blocks: astToSourceAndCompiled(readFile(PATH))
    }
}
function post(req: express.Request): State {
    const editedState = req.body as State
    const originals = astToSourceAndCompiled(readFile(PATH))
    return {
        defaultEnv: emptyEnv,
        blocks: editedSourceToAstAndBack(originals, editedState.blocks),
    }
}

// express specific stuff
const app = express()
app.use(bodyParser.json()) // for parsing application/json
const port = 3000

app.use(express.static(path.resolve(__dirname, '../dist')))
app.get('/dawdle', (req, res)=>res.json(get(req)))
app.post('/dawdle', (req, res)=>res.json(post(req)))

// run app when not under test
declare const underTest: any
try{underTest}
catch{app.listen(port, ()=>console.log(`Dawdle editor listening at http://127.0.0.1:${port}`))}
export let test: any
