const ebnf = require('ebnf')
const jsYaml = require('./js-yaml-fork')
const R = require('ramda')

// Capital words are kept but passed through, must resolve to one named token
const grammar = `
section              ::= (let | def)* (line | Block)+
let                  ::= SPACE* "let" SPACE (relation | var) NEWLINE Block (NEWLINE | EOF)
def                  ::= SPACE* "def" SPACE operator (SPACE (relation | var))* NEWLINE Block (NEWLINE | EOF)
Block                ::= INDENT section DE_INDENT
line                 ::= SPACE* (((operator | header) (SPACE Value)*) | Value) (NEWLINE | EOF)

SPACE                ::= #x20
NEWLINE              ::= #x0A
INDENT               ::= "<INDENT>" NEWLINE
DE_INDENT            ::= "</INDENT>" NEWLINE
NAME                 ::= [a-z_][a-zA-Z_0-9]*
CAPITALISED_NAME     ::= [A-Z][a-zA-Z_0-9]*

Value                ::= Literal | all_headers | relation | header | var | set
all_headers          ::= NAME ":*"
relation             ::= NAME ":"
header               ::= ":" NAME
var                  ::= NAME
operator             ::= ">" | "v" | "^" | "X" | "|" | "-" | "J" | "G" | CAPITALISED_NAME

Literal              ::= number | string | bool | template | null
set                  ::= "[" (Value (SPACE Value)*)* "]"
bool                 ::= "true" | "false"
null                 ::= "null"
number               ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)? (("e" | "E") ( "-" | "+" )? ("0" | [1-9] [0-9]*))?
string               ::= '"'  (([#x20-#x21] | [#x23-#x5B] | [#x5D-#xFFFF]) | #x5C (#x22 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '"'
template             ::= '\`' (([#x20-#x5B] | [#x5D-#x5F] | [#x61-#xFFFF]) | #x5C (#x60 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '\`'
HEXDIG               ::= [a-fA-F0-9]
`

const generatedParser = new ebnf.Grammars.W3C.Parser(grammar)
const basicParser = s=>generatedParser.getAST(addIndents(s))

/**
 * Strip leading newlines
 * Add <INDENT> tags to indented sections
 * @param {string}  source string
 */
let addIndents = s=>{
    let getIndent = (line, lineNo)=>{
        if(line.trim() === '') return null
        let match = line.match(/^(    )*[^ ]/g)
        if(!match) throw `line: ${lineNo + 1} incorrectly indented`
        return (match[0].length - 1) / 4
    }
    let split = s.replace(/^\n+/, '').split('\n')  // replace leading whitespace
    lineNosIndents = split
        .map(getIndent)
        .map((indent, lineNo)=>[lineNo, indent])
        .filter(([lineNo, indent])=>indent != null)
    let diffs = R.fromPairs(lineNosIndents
        .map(([lineNo, indent], i)=>[lineNo, (lineNosIndents[i + 1] || [0, 0])[1] - indent]))

    let lines = []
    split.forEach((line, lineNo)=>{
        lines.push(line)
        let diff = diffs[lineNo] || 0
        for (let i = 0; i < Math.abs(diff); i++){
            lines.push(diff > 0? '<INDENT>' : '</INDENT>')
        }
    })
    return lines.join('\n')
}

const multiple = ['section', 'let', 'def', 'line', 'set']

const minimal = o=>
    o.type.search(/^[A-Z]/) > -1?
        minimal(o.children[0])
        :multiple.includes(o.type)?
            {[o.type]: o.children.map(minimal)}
            : {[o.type]: o.text}

const logAst = s=>console.log(jsYaml.dump(parser(s), {
    flowKey: 'line',  // inline yaml at these points
    lineWidth: 800,
}))

const parser = s=>minimal(basicParser(s))

module.exports = {parser, basicParser, logAst, addIndents, minimal}
