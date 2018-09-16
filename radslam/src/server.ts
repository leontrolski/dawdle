import * as fs from 'fs'
import * as path from 'path'
import * as express from 'express'

import { ServerBlock, languages } from './shared'
import { Node, NodeMultiple, parser, deMunge } from './parser'
import { compiler, emptyEnv } from './compiler'
import { astToString } from './astToString'


export type Header = {
    dawdle?: any,
    type: 'header',
    originalLanguage: string,
    command: string,
} | null


const DAWDLE_COMMENT = '# {"dawdle":'
const comment_types = {
    header: 'header',
    begin: 'begin',
    end: 'end',
}
function parseComment(line: string){
    const data = JSON.parse(line.slice(2))
    return {type: data.dawdle, ...data}
}


function readFile(p: string): Array<ServerBlock>{
    let header: Header = null
    let isInDawdleBlock = false
    let thisOriginalBlock: Array<string> = []
    let thisDawdleBlock: Array<string> = []
    const serverBlocks: Array<ServerBlock> = []

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
                    astWithHeaders: null,
                })
                thisOriginalBlock = []
            }
            if(data.type === comment_types.end){
                isInDawdleBlock = false

                const astMinimal = JSON.parse(thisDawdleBlock.join('\n'))
                const dawdleSource = astToString(astMinimal)
                const ast = deMunge(astMinimal)
                const astWithHeaders = compiler(emptyEnv, ast as NodeMultiple)
                serverBlocks.push({
                    language: languages.dawdle,
                    source: dawdleSource,
                    astWithHeaders: astWithHeaders,
                })
                thisDawdleBlock = []
            }
        }
        else{
            if(!isInDawdleBlock) thisOriginalBlock.push(line)
            else thisDawdleBlock.push(line)
        }
    }
    serverBlocks.push({
        language: header.originalLanguage,
        source: thisOriginalBlock.join('\n'),
        astWithHeaders: null,
    })
    return serverBlocks
}

function getServerBlocksString(){
    const p = path.resolve(__dirname, '../examples/example_1.py')
    const serverBlocks: Array<ServerBlock> = readFile(p)
    return JSON.stringify(serverBlocks)
}

// express specific stuff
const app = express()
const port = 3000

app.use(express.static(path.resolve(__dirname, '../dist')))
app.get('/dawdle', (req, res)=>res.send(getServerBlocksString()))

app.listen(port, ()=>console.log(`Dawdle editor listening at http://127.0.0.1:${port}`))
