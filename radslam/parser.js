const util = require('util')
const ebnf = require('ebnf')
const jsYaml = require('js-yaml')
const R = require('ramda')
const inspect = o=>util.inspect(o, {depth: 16, colors: true, breakLength: 100})

// Capital words are kept but passed through, must resolve to one named token
const grammar = `
section              ::= (let | def)* (relation_literal | multirelation_line | line | aggregator | map_macro)+
Block                ::= NEWLINE INDENT section DE_INDENT
let                  ::= SPACE* "let" SPACE (relation | var) Block END
def                  ::= SPACE* "def" SPACE operator (SPACE (relation | var))* Block END
line                 ::= SPACE* ((operator (SPACE Value)*) | Value) ((Block END?) | END)
aggregator           ::= SPACE* header SPACE var (SPACE Value)* END
multirelation_line   ::= SPACE* (to_many | to_one) SPACE relation ((Block END?) | END)
map_macro            ::= SPACE* "(" "map" SPACE Value ")" SPACE template END

Value                ::= Literal | all_headers | relation | header | named_value | var | set
all_headers          ::= NAME ":*"
relation             ::= NAME ":"
to_many              ::= "-[" NAME
to_one               ::= "]-" NAME
header               ::= ":" NAME
named_value          ::= var "=" Value
var                  ::= NAME
operator             ::= CAPITALISED_NAME | "-[multirelation]-" | ">" | "v" | "^" | "X" | "U" | "-" | "J" | "G"
set                  ::= "[" (Value (SPACE Value)*)* "]"

relation_literal     ::= rl_headers (SPACE* RULE END rl_row+)?
rl_headers           ::= SPACE* SEP ((SPACE* header SPACE* SEP)+ | (SPACE* SEP)) END
rl_row               ::= SPACE* SEP ((SPACE* Value  SPACE* SEP)+ | (SPACE* SEP)) END

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
NAME                 ::= [a-z_][a-zA-Z_0-9.]*
CAPITALISED_NAME     ::= [A-Z][a-zA-Z_0-9]+
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

const munge = (o, offset)=>{
    if(R.isNil(o)) return {errors: [new ParserError()]}

    // do I even need to do this bit?
    // <INDENT>\n </INDENT>\n
    // 123456789  1234567890
    // offset = offset + (o.type === 'section'? 9 : 0)  // this goes wrong as it mutates

    // if starts with capital letter, pass through
    if(o.type.search(/^[A-Z]/) > -1) return munge(o.children[0], offset)

    const defaultInfo = multiple.includes(o.type)?
        {[o.type]: o.children.map(n=>munge(n, offset))}
        :{[o.type]: o.text}

    if(R.isNil(offset)) return defaultInfo

    return R.merge(defaultInfo, {
        start: o.start, // - offset,
        end: o.end, // - offset,
        errors: o.errors || []
    })
}
const deMunge = o =>{
    const type = getType(o)
    return multiple.includes(type)?
        {type: type, value: o[type].map(deMunge)}
        : {type: type, value: o[type]}
}
const parser = s=>munge(basicParser(s), null)
const fullParser = s =>deMunge(munge(basicParser(s), null))


const getType = o=>{
    if(R.isNil(o)) throw new UnableToDetermineTypeError(o)
    const intersection = R.intersection(Object.keys(o), Object.keys(types))
    if(intersection.length != 1) throw new UnableToDetermineTypeError(o)
    return intersection[0]
}
const getValue = o=>o[getType(o)]

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
    multirelation_line: 'multirelation_line',
    map_macro: 'map_macro',

    all_headers: 'all_headers',
    relation: 'relation',
    header: 'header',
    named_value: 'named_value',
    var: 'var',
    operator: 'operator',
    set: 'set',

    relation_literal: 'relation_literal',
    rl_headers: 'rl_headers',
    rl_row: 'rl_row',

    bool: 'bool',
    null: 'null',
    number: 'number',
    string: 'string',
    template: 'template',
    decimal: 'decimal',
    datetime: 'datetime',

    function: 'function',
}
const multiple = [
    types.section,
    types.let,
    types.def,
    types.line,
    types.aggregator,
    types.multirelation_line,
    types.map_macro,

    types.named_value,

    types.relation_literal,
    types.rl_headers,
    types.rl_row,
    types.set,
]
const is = {
    section: o=>o.type === types.section,
    let: o=>o.type === types.let,
    def: o=>o.type === types.def,
    line: o=>o.type === types.line,
    aggregator: o=>o.type === types.aggregator,
    map_macro: o=>o.type === types.map_macro,
    all_headers: o=>o.type === types.all_headers,
    relation: o=>o.type === types.relation,
    header: o=>o.type === types.header,
    named_value: o=>o.type === types.named_value,
    var: o=>o.type === types.var,
    operator: o=>o.type === types.operator,
    set: o=>o.type === types.set,
    relation_literal: o=>o.type === types.relation_literal,
    rl_headers: o=>o.type === types.rl_headers,
    rl_row: o=>o.type === types.rl_row,
    bool: o=>o.type === types.bool,
    null: o=>o.type === types.null,
    number: o=>o.type === types.number,
    string: o=>o.type === types.string,
    template: o=>o.type === types.template,
    decimal: o=>o.type === types.decimal,
    datetime: o=>o.type === types.datetime,
    function: o=>o.type === types.function,
    // compound
    letOrDef: o=>is.let(o) || is.def(o),
    singleRelationOrVarOrSet: o=>
        is.line(o) &&
        o.value.length === 1 &&
        (
            is.relation(o.value[0]) ||
            is.var(o.value[0]) ||
            is.set(o.value[0]) ||
            is.all_headers(o.value[0])
        ),
    baseOperator: o=>
        is.operator(o) &&
        Object.keys(baseOperatorInverseMap).includes(o.value),
    groupOperator: o=>
        is.operator(o) &&
        o.value === baseOperatorMap.group,
    aggregatorSection: o=>
        is.section(o) &&
        is.aggregator(o.value[0]),
}
class TypeError extends Error {constructor(type, node) {
    super(`Type error, node is not type ${type}: ${inspect(node)}`)
}}
class ParserError extends Error {constructor() {
    super(`Parser fully failed`)
}}
class UnableToDetermineTypeError extends Error {constructor(node) {
    super(`Unable to determine type of node: ${inspect(node)}`)
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
    rl_headers: makeAsserter(types.rl_headers),
    rl_row: makeAsserter(types.rl_row),
    bool: makeAsserter(types.bool),
    null: makeAsserter(types.null),
    number: makeAsserter(types.number),
    string: makeAsserter(types.string),
    template: makeAsserter(types.template),
    decimal: makeAsserter(types.decimal),
    datetime: makeAsserter(types.datetime),

    function: makeAsserter(types.function),

    baseOperator: makeAsserter('baseOperator'),  // TODO: make this less of a hack
}

module.exports = {
    inspect,
    baseOperators,
    baseOperatorMap,
    baseOperatorInverseMap,
    basicParser,
    parser,
    fullParser,
    types,
    multiple,
    getType,
    getValue,
    is,
    assertIs,
    addIndents,
    TypeError,
    ParserError,
    UnableToDetermineTypeError,
}
