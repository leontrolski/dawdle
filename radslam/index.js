const ebnf = require('ebnf')
const jsYaml = require('js-yaml')
const R = require('ramda')

const grammar = `
program              ::= NEWLINE* block+

WS                   ::= #x20+   /* " "+  */
NEWLINE              ::= #x0A    /* "\n" */
indent               ::= #x20 #x20 #x20 #x20
line                 ::= indent* operator WS (value WS)* value (NEWLINE | EOF)
block                ::= line+ (NEWLINE+ | EOF)

value                ::= literal | relation | header | var
set                  ::= "[" (value WS)* value "]"

literal              ::= number | string | true | false | template
false                ::= "false"
null                 ::= "null"
true                 ::= "true"

var                  ::= [a-zA-Z_][a-zA-Z_0-9]*
relation             ::= [a-zA-Z_][a-zA-Z_0-9]* ":"
header               ::= ":" [a-zA-Z_][a-zA-Z_0-9]*
operator             ::= ">" | "v" | "^" | "X" | "|" | "-" | "J" | "G"

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

v 5 \`bar\`

> 4 "foo"
> 5
    G 6 x_fooooo1
    J 9


- 7 :some_header some_relation:
    X "la"
        | "loo"
`)

const useful = o=>o.children.length?
    {t: o.type, c: o.children.map(useful)}
    : o.text.trim() === ''?
        {t: o.type}
        : {t: o.type, v: o.text}


console.log(jsYaml.dump(useful(ast)))
// console.log(ast)