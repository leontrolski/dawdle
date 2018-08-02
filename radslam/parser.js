const ebnf = require('ebnf')
const jsYaml = require('js-yaml')
const R = require('ramda')

// Capital words are kept but passed through, must resolve to one named token
const grammar = `
section              ::= (let | def)* (line | group_line | relation_literal | Block)+
let                  ::= SPACE* "let" SPACE (relation | var) NEWLINE Block END
def                  ::= SPACE* "def" SPACE operator (SPACE (relation | var))* NEWLINE Block END
Block                ::= INDENT section DE_INDENT
line                 ::= SPACE* ((operator (SPACE Value)*) | Value) END
group_line           ::= SPACE* header SPACE var (SPACE Value)* END


Value                ::= Literal | all_headers | relation | header | named_var | var | set
all_headers          ::= NAME ":*"
relation             ::= NAME ":"
header               ::= ":" NAME
named_var            ::= var "=" Value
var                  ::= NAME
operator             ::= ">" | "v" | "^" | "X" | "U" | "-" | "J" | "G" | CAPITALISED_NAME
set                  ::= "[" (Value (SPACE Value)*)* "]"

relation_literal     ::= headers (SPACE* RULE END row+)?
headers              ::= SPACE* SEP ((SPACE* header SPACE* SEP)+ | (SPACE* SEP)) END
row                  ::= SPACE* SEP ((SPACE* Value  SPACE* SEP)+ | (SPACE* SEP)) END

Literal              ::= number | string | bool | template | null
bool                 ::= "true" | "false"
null                 ::= "null"
number               ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)? (("e" | "E") ( "-" | "+" )? ("0" | [1-9] [0-9]*))?
string               ::= '"'  (([#x20-#x21] | [#x23-#x5B] | [#x5D-#xFFFF]) | #x5C (#x22 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '"'
template             ::= '\`' (([#x20-#x5B] | [#x5D-#x5F] | [#x61-#xFFFF]) | #x5C (#x60 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '\`'
HEXDIG               ::= [a-fA-F0-9]

SPACE                ::= #x20
NEWLINE              ::= #x0A
END                  ::= (NEWLINE | EOF)
SEP                  ::= "|"
RULE                 ::= "-"+
INDENT               ::= "<INDENT>" NEWLINE
DE_INDENT            ::= "</INDENT>" NEWLINE
NAME                 ::= [a-z_][a-zA-Z_0-9]*
CAPITALISED_NAME     ::= [A-Z][a-zA-Z_0-9]*
`
const multiple = [
    'section',
    'let',
    'def',
    'line',
    'group_line',
    'relation_literal',
    'headers',
    'row',
    'set',
    'named_var',
]

const generatedParser = new ebnf.Grammars.W3C.Parser(grammar)
const basicParser = s=>generatedParser.getAST(addIndents(s))

/**
 * Strip leading newlines
 * Add <INDENT> tags to indented sections
 * @param {string}  source string
 */
const addIndents = s=>{
    const getIndent = (line, lineNo)=>{
        if(line.trim() === '') return null
        const match = line.match(/^(    )*[^ ]/g)
        if(!match) throw `line: ${lineNo + 1} incorrectly indented`
        return (match[0].length - 1) / 4
    }
    const split = s.split('\n')
    lineNosIndents = split
        .map(getIndent)
        .map((indent, lineNo)=>[lineNo, indent])
        .filter(([lineNo, indent])=>indent != null)
    const diffs = R.fromPairs(lineNosIndents
        .map(([lineNo, indent], i)=>[lineNo, (lineNosIndents[i + 1] || [0, 0])[1] - indent]))

    let lines = []
    split.forEach((line, lineNo)=>{
        lines.push(line)
        const diff = diffs[lineNo] || 0
        for (let i = 0; i < Math.abs(diff); i++){
            lines.push(diff > 0? '<INDENT>' : '</INDENT>')
        }
    })
    return lines.join('\n')
}

const minimal = o=>
    o.type.search(/^[A-Z]/) > -1?
        minimal(o.children[0])
        :multiple.includes(o.type)?
            {[o.type]: o.children.map(minimal)}
            : {[o.type]: o.text}

const log = o=>console.log(jsYaml.dump(o, {lineWidth: 800,}))

const parser = s=>minimal(basicParser(s))

module.exports = {parser, basicParser, log, addIndents, minimal}
