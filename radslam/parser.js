const ebnf = require('ebnf')
const jsYaml = require('./js-yaml-fork')
const R = require('ramda')

// backtick is #x60
// quote is #x22
// backslash is #x5C
// Capital words are kept but passed through, must resolve to one named token

// program              ::= definition* (line | block)+ EOF
// definition           ::= let NEWLINE*
// block                ::= INDENT line+ DE_INDENT
// def                  ::= SPACE* DEF SPACE custom_operator (SPACE Value)* NEWLINE
// line                 ::= SPACE* (relation | (operator (SPACE Value)*) | var) NEWLINE

// add Value to line
const grammar = `
program              ::= let*
let                  ::= SPACE* LET SPACE (relation | var) NEWLINE block (NEWLINE | EOF)
block                ::= INDENT let* (line | block)+ DE_INDENT
line                 ::= SPACE* (relation | (operator (SPACE Value)*) | var | Value) NEWLINE
Value                ::= Literal | relation | header | var | set

SPACE                ::= #x20
NEWLINE              ::= #x0A
INDENT               ::= "<INDENT>" NEWLINE
DE_INDENT            ::= "</INDENT>" NEWLINE
NAME                 ::= [a-z_][a-zA-Z_0-9]*
CAPITALISED_NAME     ::= [A-Z][a-zA-Z_0-9]*
DEF                  ::= "def"
LET                  ::= "let"

set                  ::= "[" (Value (SPACE Value)*)* "]"
var                  ::= NAME
relation             ::= NAME ":"
header               ::= ":" NAME
custom_operator      ::= CAPITALISED_NAME
operator             ::= ">" | "v" | "^" | "X" | "|" | "-" | "J" | "G" | custom_operator

Literal              ::= number | string | bool | template | null
bool                 ::= "true" | "false"
null                 ::= "null"
number               ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)? (("e" | "E") ( "-" | "+" )? ("0" | [1-9] [0-9]*))?
string               ::= '"'  (([#x20-#x21] | [#x23-#x5B] | [#x5D-#xFFFF]) | #x5C (#x22 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '"'
template             ::= '\`' (([#x20-#x5B] | [#x5D-#x5F] | [#x61-#xFFFF]) | #x5C (#x60 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '\`'
HEXDIG               ::= [a-fA-F0-9]
`

const _parser = new ebnf.Grammars.W3C.Parser(grammar)
const parser = s=>_parser.getAST(addIndents(s))

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

const multiple = ['program', 'definition', 'block', 'let', 'def', 'line', 'set']

const useful = o=>R.merge(
    {t: o.type},
    o.children.length?
        o.type.search(/^[A-Z]/) > -1?
            {c:  useful(o.children[0])}
            : {c: o.children.map(useful)}
        : o.text.trim() === ''?
            {}
            : {v: o.text}
)

const minimal = o=>
    o.type.search(/^[A-Z]/) > -1?
        minimal(o.children[0])
        :multiple.includes(o.type)?
            {[o.type]: o.children.map(minimal)}
            : {[o.type]: o.text}

const logAst = ast=>console.log(jsYaml.dump(minimal(ast), {
    flowKey: 'line',  // inline yaml at these points
    lineWidth: 800,
}))

module.exports = {parser, logAst, addIndents, useful, minimal}
