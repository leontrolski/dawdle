const ebnf = require('ebnf')
const jsYaml = require('js-yaml')
const R = require('ramda')

// TODO: specifiy:
// > Func Arg Arg ...
// v Header Header ...
// ^ Header Func Arg Arg ...
// X Arg
// | Arg
// - Arg
// J Arg
// G Header Header ...
//     AGG_BLOCK
// Relation
//     BLOCK
// Var
//     BLOCK
// Def Arg Arg ...
//     BLOCK

// backtick is #x60
// quote is #x22
// backslash is #x5C
let grammar = `
program              ::= NEWLINE* block+
block                ::= (INDENT | SECTION) (line | block)+ (DE_INDENT | DE_SECTION)
line                 ::= SPACE* (relation | (operator (SPACE value)*) | var) NEWLINE
value                ::= literal | relation | header | var | set

SPACE                ::= #x20
NEWLINE              ::= #x0A
INDENT               ::= "<INDENT>" NEWLINE
DE_INDENT            ::= "</INDENT>" NEWLINE
SECTION              ::= "<SECTION>" NEWLINE
DE_SECTION           ::= "</SECTION>" NEWLINE
NAME                 ::= [a-z_][a-zA-Z_0-9]*
CAPITALISED_NAME     ::= [A-Z][a-zA-Z_0-9]*

set                  ::= "[" value (SPACE value)* "]"
var                  ::= NAME
relation             ::= NAME ":"
header               ::= ":" NAME
operator             ::= ">" | "v" | "^" | "X" | "|" | "-" | "J" | "G" | "let" | CAPITALISED_NAME

literal              ::= number | string | bool | template
bool                 ::= "true" | "false"
null                 ::= "null"
number               ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)? (("e" | "E") ( "-" | "+" )? ("0" | [1-9] [0-9]*))?
string               ::= '"'  (([#x20-#x21] | [#x23-#x5B] | [#x5D-#xFFFF]) | #x5C (#x22 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '"'
template             ::= '\`' (([#x20-#x5B] | [#x5D-#x5F] | [#x61-#xFFFF]) | #x5C (#x60 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '\`'
HEXDIG               ::= [a-fA-F0-9]
`

let addIndents = s=>{
    let lastIndent = 0
    let lines = ['<SECTION>']
    let addLineBreak = false
    s.split('\n').forEach((line, lineNumber)=>{
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
            lastIndent = lastIndent + diff
            if(addLineBreak){
                lines.push('</SECTION>')
                lines.push('<SECTION>')
                addLineBreak = false
            }
            lines.push(line)
        }
    })
    lines.push('</SECTION>')
    return lines.join('\n') + '\n'
}

let s = `a_relation:

J
v 5 \`bar\`

> 4 "foo"
> 5
    Custom 6 x_fooooo1
    J 9
f
- 7 :some_header some_relation:
    let barr:
        tr:

    X "la"
        | "loo" [4 5 :other_table]

some_set
- other_set
`

console.log([s])
console.log([addIndents(s)])

const parser = new ebnf.Grammars.W3C.Parser(grammar)
const ast = parser.getAST(addIndents(s))
// const ast = parser.getAST(s)

const alwaysSingular = ['value', 'literal']
const useful = o=>o.children.length?
    alwaysSingular.includes(o.type)?
        {t: o.type, c:  useful(o.children[0])}
        : {t: o.type, c: o.children.map(useful)}
    : o.text.trim() === ''?
        {t: o.type}
        : {t: o.type, v: o.text}


console.log(jsYaml.dump(useful(ast)))
