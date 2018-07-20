const ebnf = require('ebnf')
const jsYaml = require('js-yaml')
const R = require('ramda')

console.log(8)
const grammar = `
program              ::= NEWLINE* block+

WS                   ::= #x20+   /* " "+  */
NEWLINE              ::= #x0A    /* "\n" */
indent               ::= #x20 #x20 #x20 #x20
line                 ::= indent* (literal WS)* literal (NEWLINE | EOF)
block                ::= line+ (NEWLINE+ | EOF)

literal              ::= number | string | true | false | template
false                ::= "false"
null                 ::= "null"
true                 ::= "true"

restrict             ::= ">"
project              ::= "v"
extend               ::= "^"
cartesian            ::= "X"
union                ::= "|"
difference           ::= "-"
join                 ::= "J"
group                ::= "G"

number               ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)? (("e" | "E") ( "-" | "+" )? ("0" | [1-9] [0-9]*))?
string               ::= '"'  (([#x20-#x21] | [#x23-#x5B] | [#x5D-#xFFFF]) | #x5C (#x22 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '"'
template             ::= '\`' (([#x20-#x5B] | [#x5D-#x5F] | [#x61-#xFFFF]) | #x5C (#x60 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '\`'
HEXDIG               ::= [a-fA-F0-9]
`
// backtick is #x60
// quote is #x22
// backslash is #x5C
const parser = new ebnf.Grammars.W3C.Parser(grammar)

const ast = parser.getAST(`

5 \`bar\`

4 "foo"
5
    6
    9


7
`)

const useful = o=>o.children.length?
    {t: o.type, c: o.children.map(useful)}
    : o.text === '\n'?
        {t: o.type}
        : {t: o.type, v: o.text}


console.log(jsYaml.dump(useful(ast)))
// console.log(ast)