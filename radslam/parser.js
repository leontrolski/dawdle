const ebnf = require('ebnf')
const jsYaml = require('js-yaml')
const R = require('ramda')

// Capital words are kept but passed through, must resolve to one named token
const grammar = `
section              ::= (let | def)* (relation_literal | line | aggregator | map_macro | Block)+
Block                ::= INDENT section DE_INDENT
let                  ::= SPACE* "let" SPACE (relation | var) NEWLINE Block END
def                  ::= SPACE* "def" SPACE operator (SPACE (relation | var))* NEWLINE Block END
line                 ::= SPACE* ((operator (SPACE Value)*) | Value) END
aggregator           ::= SPACE* header SPACE var (SPACE Value)* END
map_macro            ::= SPACE* "(" "map" SPACE Value ")" SPACE template END

Value                ::= Literal | all_headers | relation | header | named_value | var | set
all_headers          ::= NAME ":*"
relation             ::= NAME ":"
header               ::= ":" NAME
named_value          ::= var "=" Value
var                  ::= NAME
operator             ::= ">" | "v" | "^" | "X" | "U" | "-" | "J" | "G" | CAPITALISED_NAME
set                  ::= "[" (Value (SPACE Value)*)* "]"

relation_literal     ::= headers (SPACE* RULE END row+)?
headers              ::= SPACE* SEP ((SPACE* header SPACE* SEP)+ | (SPACE* SEP)) END
row                  ::= SPACE* SEP ((SPACE* Value  SPACE* SEP)+ | (SPACE* SEP)) END

Literal              ::= number | string | bool | template | null | decimal | datetime
bool                 ::= "true" | "false"
null                 ::= "null"
number               ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)? (("e" | "E") ( "-" | "+" )? ("0" | [1-9] [0-9]*))?
string               ::= '"'  (([#x20-#x21] | [#x23-#x5B] | [#x5D-#xFFFF]) | #x5C (#x22 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '"'
template             ::= '\`' (([#x20-#x5B] | [#x5D-#x5F] | [#x61-#xFFFF]) | #x5C (#x60 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '\`'
decimal              ::= "$" "-"? [0-9]+ ("." [0-9]+)?
datetime             ::= "~" [0-9TZ#x2D:+]+
HEXDIG               ::= [a-fA-F0-9]

SPACE                ::= #x20
NEWLINE              ::= #x0A
END                  ::= (NEWLINE | EOF)
SEP                  ::= "|"
RULE                 ::= "-"+
INDENT               ::= "<INDENT>" NEWLINE
DE_INDENT            ::= "</INDENT>" NEWLINE
NAME                 ::= [a-z_][a-zA-Z_0-9.-]*
CAPITALISED_NAME     ::= [A-Z][a-zA-Z_0-9]*
`
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

const getType = o=>Object.keys(o)[0]

// repetitive enum-like definitions
const baseOperators = {
    filter: 'filter',
    select: 'select',
    extend: 'extend',
    cross: 'cross',
    union: 'union',
    difference: 'difference',
    join: 'join',
    group: 'group',
}
const baseOperatorMap = {
    filter: '>',
    select: 'v',
    extend: '^',
    cross: 'X',
    union: 'U',
    difference: '-',
    join: 'J',
    group: 'G',
}
const baseOperatorInverseMap = R.invertObj(baseOperatorMap)
const types = {
    section: 'section',
    let: 'let',
    def: 'def',
    line: 'line',
    aggregator: 'aggregator',
    map_macro: 'map_macro',

    all_headers: 'all_headers',
    relation: 'relation',
    header: 'header',
    named_value: 'named_value',
    var: 'var',
    operator: 'operator',
    set: 'set',

    relation_literal: 'relation_literal',
    headers: 'headers',
    row: 'row',

    bool: 'bool',
    null: 'null',
    number: 'number',
    string: 'string',
    template: 'template',
    decimal: 'decimal',
    datetime: 'datetime',
}
const multiple = [
    types.section,
    types.let,
    types.def,
    types.line,
    types.aggregator,
    types.map_macro,

    types.named_value,

    types.relation_literal,
    types.headers,
    types.row,
    types.set,
]
const is = {
    section: o=>getType(o) === types.section,
    let: o=>getType(o) === types.let,
    def: o=>getType(o) === types.def,
    line: o=>getType(o) === types.line,
    aggregator: o=>getType(o) === types.aggregator,
    map_macro: o=>getType(o) === types.map_macro,
    all_headers: o=>getType(o) === types.all_headers,
    relation: o=>getType(o) === types.relation,
    header: o=>getType(o) === types.header,
    named_value: o=>getType(o) === types.named_value,
    var: o=>getType(o) === types.var,
    operator: o=>getType(o) === types.operator,
    set: o=>getType(o) === types.set,
    relation_literal: o=>getType(o) === types.relation_literal,
    headers: o=>getType(o) === types.headers,
    row: o=>getType(o) === types.row,
    bool: o=>getType(o) === types.bool,
    null: o=>getType(o) === types.null,
    number: o=>getType(o) === types.number,
    string: o=>getType(o) === types.string,
    template: o=>getType(o) === types.template,
    decimal: o=>getType(o) === types.decimal,
    datetime: o=>getType(o) === types.datetime,
    // compound
    letOrDef: o=>is.let(o) || is.def(o),
    singleRelation: o=>
        is.line(o) &&
        o[types.line].length === 1 &&
        is.relation(o[types.line][0]),
    singleVar: o=>
        is.line(o) &&
        o[types.line].length === 1 &&
        is.var(o[types.line][0]),
    singleSet: o=>
        is.line(o) &&
        o[types.line].length === 1 &&
        is.set(o[types.line][0]),
}
class TypeError extends Error {constructor(type, node) {
    super(`Type error, node is not type ${type}: ${inspect(node)}`)
}}
const makeAsserter = type=>o=>{
    if(!is[type]) throw new TypeError(type, o)
    return o
}
const assertIs = {
    section: makeAsserter(types.section),
    let: makeAsserter(types.let),
    def: makeAsserter(types.def),
    line: makeAsserter(types.line),
    aggregator: makeAsserter(types.aggregator),
    map_macro: makeAsserter(types.map_macro),
    all_headers: makeAsserter(types.all_headers),
    relation: makeAsserter(types.relation),
    header: makeAsserter(types.header),
    named_value: makeAsserter(types.named_value),
    var: makeAsserter(types.var),
    operator: makeAsserter(types.operator),
    set: makeAsserter(types.set),
    relation_literal: makeAsserter(types.relation_literal),
    headers: makeAsserter(types.headers),
    row: makeAsserter(types.row),
    bool: makeAsserter(types.bool),
    null: makeAsserter(types.null),
    number: makeAsserter(types.number),
    string: makeAsserter(types.string),
    template: makeAsserter(types.template),
    decimal: makeAsserter(types.decimal),
    datetime: makeAsserter(types.datetime),
}

module.exports = {
    // main
    baseOperators,
    baseOperatorMap,
    baseOperatorInverseMap,
    parser,
    types,
    getType,
    is,
    assertIs,
    // extras
    basicParser,
    log,
    addIndents,
    minimal,
    TypeError,
}
