const ebnf = require('ebnf')
const jsYaml = require('./js-yaml-fork')
const R = require('ramda')

// backtick is #x60
// quote is #x22
// backslash is #x5C
// Capital words are kept but passed through, must resolve to one named token
const grammar = `
program              ::= NEWLINE* block+
block                ::= (INDENT | SECTION) (line | block)+ (DE_INDENT | DE_SECTION)
line                 ::= SPACE* (relation | (operator (SPACE Value)*) | var) NEWLINE
Value                ::= Literal | relation | header | var | set

SPACE                ::= #x20
NEWLINE              ::= #x0A
INDENT               ::= "<INDENT>" NEWLINE
DE_INDENT            ::= "</INDENT>" NEWLINE
SECTION              ::= "<SECTION>" NEWLINE
DE_SECTION           ::= "</SECTION>" NEWLINE
NAME                 ::= [a-z_][a-zA-Z_0-9]*
CAPITALISED_NAME     ::= [A-Z][a-zA-Z_0-9]*

set                  ::= "[" (Value (SPACE Value)*)* "]"
var                  ::= NAME
relation             ::= NAME ":"
header               ::= ":" NAME
operator             ::= ">" | "v" | "^" | "X" | "|" | "-" | "J" | "G" | "let" | "def" | CAPITALISED_NAME

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
 * Add <SECTION> tags around newline separated sections
 * Add <INDENT> tags to indented sections
 *
 * TODO: refactor, it's pretty ugly
 * @param {string}  source string
 */
let addIndents = s=>{
    let lastIndent = 0
    let totalDiff = 0
    let lines = ['<SECTION>']
    let addLineBreak = false
    s.replace(/^\n+/, '').split('\n').forEach((line, lineNumber)=>{
        if(line.trim() === ''){
            addLineBreak = true
        }
        else{
            let match = line.match(/^(    )*[^ ]/g)
            if(!match) throw `line: ${lineNumber + 1} incorrectly indented`
            let diff = ((match[0].length - 1) / 4) - lastIndent
            for (let i = 0; i < Math.abs(diff); i++){
                lines.push(diff > 0? '<INDENT>' : '</INDENT>')
            }
            totalDiff += diff
            lastIndent = lastIndent + diff
            if(addLineBreak){
                lines.push('</SECTION>')
                lines.push('<SECTION>')
                addLineBreak = false
            }
            lines.push(line)
        }
    })
    // dutty hack
    for (let i = 0; i < totalDiff; i++){
        lines.push('</INDENT>')
    }
    lines.push('</SECTION>')
    return lines.join('\n') + '\n'
}

const multiple = ['program', 'block', 'line', 'set']

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
