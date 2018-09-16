import * as fs from 'fs'
import * as path from 'path'
import * as express from 'express'

import {serverBlocks, ServerBlock} from './shared'

const app = express()
const port = 3000

app.use(express.static(path.resolve(__dirname, '../dist')))
app.get('/dawdle', (req, res)=>res.send(JSON.stringify(serverBlocks)))

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


function readFile(p: string){
    let isDawdleFile = false
    const data = fs.readFileSync(p, 'utf8')
    for(let line of data.split('\n')){
        if(line.startsWith(DAWDLE_COMMENT)){
            const data = parseComment(line)
            console.log(data)
        }
    }
}

readFile(path.resolve(__dirname, '../examples/example_1.py'))

// not quite...
// async function handle(p: Promise<any>){
//     const data = await p
//     return function(req, res){
//         res.send(data)
//     }
// }

// app.listen(port, ()=>console.log(`Dawdle editor listening at http://127.0.0.1:${port}`))
