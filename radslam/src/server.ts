import * as fs from 'fs'
import { resolve as joinPath } from 'path'
import { dissoc, pipe, isEmpty } from 'ramda'
import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as stripAnsi from 'strip-ansi'

import {
    DawdleModuleAPI, FileBlock, FileState, CommentData,
    ServerBlock, ServerState, TestCaseMap, ServerError } from './shared'
import { Section, deMunge, parser } from './parser'
import { compiler, emptyEnv } from './compiler'
import { astToString, jsonifyAndIndent } from './astToString'

const DAWDLE_COMMENT = '// {"dawdle":'
const DAWDLE_COMMENT_OPENER = '// {"dawdle": "header", "originalLanguage": "typescript"}'
const DAWDLE_COMMENT_BEGIN = '// {"dawdle": "begin"'  // note missing closing bracket
const DAWDLE_COMMENT_END = '// {"dawdle": "end"}'
const comment_types = {
    header: 'header',
    begin: 'begin',
    end: 'end',
}
function parseComment(line: string): CommentData {
    const data = JSON.parse(line.slice(3))
    return {type: data.dawdle, ...data} as CommentData
}
function getDawdleModule(path: string): DawdleModuleAPI {
    try{delete require.cache[require.resolve(path)]}
    catch{}
    return require(path) as DawdleModuleAPI
}

const fakeTestCases: TestCaseMap = {
    'a test case': emptyEnv,
    'another test case': emptyEnv,
}

function readFile(path: string): FileState {
    let header: CommentData = null
    let isInDawdleBlock = false
    let thisOriginalBlock: Array<string> = []
    let thisDawdleBlock: Array<string> = []
    let thisDawleBeginCommentData: CommentData = null
    const serverBlocks: Array<FileBlock> = []

    const fileString = fs.readFileSync(path, 'utf8')
    for(let line of fileString.split('\n')){
        if(line.startsWith(DAWDLE_COMMENT)){
            const data = parseComment(line)
            if(data.type === comment_types.header){
                header = data as CommentData
            }
            if(!header) throw new Error('dawdle comment found in file without header comment')
            if(data.type === comment_types.begin){
                if(isInDawdleBlock) throw new Error('nested dawdle blocks are not supported')
                isInDawdleBlock = true
                thisDawleBeginCommentData = data
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
                    commentData: thisDawleBeginCommentData,
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
    return {header: header, blocks: serverBlocks, defaultEnv: getDawdleModule(path).defaultEnv}
}

function firstTimeCompileBlocks(path: string, fileState: FileState): ServerState {
    const compiledBlocks = fileState.blocks.map((block, i)=>{
        if(block.language !== 'dawdle'){
            return {
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
        const astWithHeaders = compiler(fileState.defaultEnv, ast as Section, false)
        return {
            language: block.language,
            source: dawdleSource,
            astWithHeaders: astWithHeaders,
            // testCases: {},
            testCases: dawdleSource.includes('JoinClone')? fakeTestCases : {},
            errors: [],
            commentData: block.commentData,
        }
    })
    return {path, defaultEnv: fileState.defaultEnv, blocks: compiledBlocks}
}
function compileBlocks(state: ServerState): ServerState {
    const defaultEnv = getDawdleModule(state.path).defaultEnv
    const compiledBlocks = state.blocks.map(block=>{
        if(block.language !== 'dawdle') return block
        // else is a dawdle block
        let dawdleSource = null
        let astWithHeaders = null
        let errors: ServerError[] = []
        const editedDawdleSource = block.source.trim() + '\n'  // TODO: sort out this ambiguity?
        try{
            const astMinimal = parser(editedDawdleSource)
            dawdleSource = astToString(astMinimal)
            const ast = deMunge(astMinimal)
            astWithHeaders = compiler(defaultEnv, ast as Section, false)
        }
        catch(error){
            console.log('Compilation error: ', error.message)
            errors = [{message: stripAnsi(error.message), lineNumber: null}]
        }
        return {
            language: block.language,
            source: dawdleSource,
            astWithHeaders: astWithHeaders,
            // testCases: {},
            testCases: (dawdleSource || editedDawdleSource).includes('JoinClone')? fakeTestCases : {},
            errors: errors,
            commentData: block.commentData,
        }
    })
    return {path: state.path, defaultEnv, blocks: compiledBlocks}
}
function writeBlocksToFile(editedBlocks: ServerBlock[]): string {
    let fileString = DAWDLE_COMMENT_OPENER + '\n'
    editedBlocks.forEach(block=>{
        if(block.language !== 'dawdle'){
            fileString += block.source
        }
        else { // is a dawdle block
            const relevant = pipe(dissoc('dawdle'), dissoc('type'))(block.commentData)
            const comma = isEmpty(relevant)? '' : ', '
            fileString += '\n' + DAWDLE_COMMENT_BEGIN + comma + JSON.stringify(relevant).slice(1) + '\n'
            const editedDawdleSource = block.source.trim() + '\n'  // TODO: sort out this ambiguity?
            const astMinimal = parser(editedDawdleSource)
            fileString += jsonifyAndIndent(astMinimal)
            fileString += '\n' + DAWDLE_COMMENT_END + '\n'
        }
    })
    return fileString
}

// read from the file
function read(req: express.Request): ServerState {
    const path = joinPath(__dirname, '..', req.body.path)
    const fileState = readFile(path)
    return firstTimeCompileBlocks(path, fileState)
}
// validate and parse edited state
function write(req: express.Request): ServerState {
    const editedState = req.body as ServerState
    return compileBlocks(editedState)
}
// write edited state to file
function save(req: express.Request): boolean {
    const editedState = req.body as ServerState
    const editedSource = writeBlocksToFile(editedState.blocks)
    fs.writeFileSync(editedState.path, editedSource)
    return true
}

// express specific stuff
const app = express()
app.use(bodyParser.json()) // for parsing application/json
const port = 3000

app.use(express.static(joinPath(__dirname, '../dist')))
app.post('/read', (req, res)=>res.json(read(req)))
app.post('/write', (req, res)=>res.json(write(req)))
app.post('/save', (req, res)=>res.json(save(req)))

// run app when not under test
declare const underTest: any
try{underTest}
catch{app.listen(port, ()=>console.log(`Dawdle editor listening at http://127.0.0.1:${port}`))}
export let test: any = null
