import * as fs from 'fs'
import * as path from 'path'
import { zip, dissoc, pipe, isEmpty } from 'ramda'
import * as express from 'express'
import * as bodyParser from 'body-parser'

import { CommentData, ServerBlock, ServerState, TestCaseMap, ServerError } from './shared'
import { Section, deMunge, parser } from './parser'
import { compiler, emptyEnv } from './compiler'
import { astToString, nodeToString, jsonifyAndIndent } from './astToString'
import { log } from './errorsAndAsserters';

const PATH = path.resolve(__dirname, '../examples/example_1.ts')

type PreBlock = {
    language: string,
    source: string,
    commentData?: CommentData,
}

const DAWDLE_COMMENT = '// {"dawdle":'
const DAWDLE_COMMENT_OPENER = '// {"dawdle": "header", "originalLanguage": "typescript", "command": "venv/python $FILE --dawdle"}'
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

const fakeTestCases: TestCaseMap = {
    'a test case': emptyEnv,
    'another test case': emptyEnv,
}

function readFile(p: string): Array<PreBlock>{
    let header: CommentData = null
    let isInDawdleBlock = false
    let thisOriginalBlock: Array<string> = []
    let thisDawdleBlock: Array<string> = []
    let thisDawleBeginCommentData: CommentData = null
    const serverBlocks: Array<PreBlock> = []

    const fileString = fs.readFileSync(p, 'utf8')
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
            commentData: block.commentData,
        }
    })
}
function editedSourceToAstAndBack(editedBlocks: ServerBlock[]): ServerBlock[] {
    return editedBlocks.map(block=>{
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
            astWithHeaders = compiler(emptyEnv, ast as Section)
        }
        catch(error){
            errors = [{message: error.message, lineNumber: null}]
        }
        return {
            id: block.id,
            language: block.language,
            source: dawdleSource,
            astWithHeaders: astWithHeaders,
            // testCases: {},
            testCases: (dawdleSource || editedDawdleSource).includes('JoinClone')? fakeTestCases : {},
            errors: errors,
            commentData: block.commentData,
        }
    })
}
function editedSourceToFileString(editedBlocks: ServerBlock[]): string {
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
function get(req: express.Request): ServerState {
    const fileBlocks = readFile(PATH)
    return {
        defaultEnv: emptyEnv,
        blocks: astToSourceAndCompiled(fileBlocks)
    }
}
// validate and parse edited state
function put(req: express.Request): ServerState {
    const editedState = req.body as ServerState
    return {
        defaultEnv: emptyEnv,
        blocks: editedSourceToAstAndBack(editedState.blocks),
    }
}
// write edited state to file
function post(req: express.Request): boolean {
    const editedState = req.body as ServerState
    const editedSource = editedSourceToFileString(editedState.blocks)
    fs.writeFileSync(PATH, editedSource)
    return true
}

// express specific stuff
const app = express()
app.use(bodyParser.json()) // for parsing application/json
const port = 3000

app.use(express.static(path.resolve(__dirname, '../dist')))
app.get('/dawdle', (req, res)=>res.json(get(req)))
app.put('/dawdle', (req, res)=>res.json(put(req)))
app.post('/dawdle', (req, res)=>res.json(post(req)))

// run app when not under test
declare const underTest: any
try{underTest}
catch{app.listen(port, ()=>console.log(`Dawdle editor listening at http://127.0.0.1:${port}`))}
export let test: any
