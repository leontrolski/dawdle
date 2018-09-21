import * as util from 'util'
import * as ebnf from 'ebnf'
import * as R from 'ramda'

export function inspect(o: any): string{
    return util.inspect(o, {depth: 16, colors: true, breakLength: 100})
}

export type NodeMinimal = any
type BaseNode = {
    type: string,
    compiledType?: string,
    compiledValue?: any,  // TODO
    lineI?: number,
}
export type NodeMultiple = BaseNode & {value: Array<Node>}
export type NodeSingle = BaseNode & {value: string}
export type Node = NodeMultiple | NodeSingle
// todo: flesh these out a bit more
// multiple
export type Section = NodeMultiple
export type Let = BaseNode & {
    type: 'let',
    value: [Relation | Var, Section],
}
export type Def = NodeMultiple & {
    type: 'def',
    value: [Operator, Relation | Var, Relation | Var, Section],
}
export type Line = {
    type: 'line',
    value: [Operator, Value, Value],
}
export type Aggregator = NodeMultiple
export type MapMacro = NodeMultiple
export type NamedValue = NodeMultiple
export type RelationLiteral = NodeMultiple
export type RlHeaders = NodeMultiple
export type RlRow = NodeMultiple
export type Set = NodeMultiple
export type AllHeaders = NodeSingle
export type Relation = NodeSingle
export type Header = NodeSingle
export type Var = NodeSingle
export type Operator = NodeSingle
export type Bool = NodeSingle
export type Null = NodeSingle
export type Number = NodeSingle
export type String = NodeSingle
export type Template = NodeSingle
export type Decimal = NodeSingle
export type Datetime = NodeSingle
export type Function = NodeSingle

export type Literal = Number | String | Bool | Template | Null | Decimal | Datetime
export type Value = Literal | AllHeaders | Relation | Header | NamedValue | Var | Set

// Capital words are kept but passed through, must resolve to one named token
const grammar = `
section              ::= (let | def)* (relation_literal | line | aggregator | map_macro)+
Block                ::= NEWLINE INDENT section DE_INDENT
let                  ::= SPACE* "let" SPACE (relation | var) Block END
def                  ::= SPACE* "def" SPACE operator (SPACE (relation | var))* Block END
/* TODO: refactor this next line, there's something incorrect going on.. */
line                 ::= SPACE* (((to_many | to_one) (SPACE Value)) | (operator (SPACE Value)*) | Value) ((Block END?) | END)
aggregator           ::= SPACE* header SPACE var (SPACE Value)* END
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
NAME                 ::= [a-z_][a-zA-Z_0-9.-]*
CAPITALISED_NAME     ::= [A-Z][a-zA-Z_0-9-]+
`
const generatedParser = new ebnf.Grammars.W3C.Parser(grammar, {})
export function basicParser(s: string): ebnf.IToken {
    return generatedParser.getAST(addIndents(s))
}

/**
 * Strip leading newlines
 * Add <INDENT> tags to indented sections
 * @param {string}  source string
 */
export function addIndents(s: string){
    function getIndent(line: string, lineNo: number){
        if(line.trim() === '') return null
        const match = line.match(/^(    )*[^ ]/g)
        if(!match) throw `line: ${lineNo + 1} incorrectly indented`
        return (match[0].length - 1) / 4
    }
    const split = s.split('\n')
    const lineNosIndents = split
        .map(getIndent)
        .map((indent, lineNo)=>[lineNo, indent])
        .filter(([lineNo, indent])=>indent != null)
    const diffs= lineNosIndents.map(([lineNo, indent], i)=>
        [lineNo, (lineNosIndents[i + 1] || [0, 0])[1] - indent] as [number, number])
    const diffMap = R.fromPairs(diffs)

    let lines: string[] = []
    split.forEach((line, lineNo)=>{
        lines.push(line.replace(/ +$/, ''))  // trim right
        const diff = diffMap[lineNo] || 0
        for (let i = 0; i < Math.abs(diff); i++){
            lines.push(diff > 0? '<INDENT>' : '</INDENT>')
        }
    })
    return lines.join('\n')
}

export function munge(o: ebnf.IToken, offset: number): NodeMinimal {
    if(R.isNil(o)) return {errors: [new ParserError()]}

    // do I even need to do this bit?
    // <INDENT>\n </INDENT>\n
    // 123456789  1234567890
    // offset = offset + (o.type === 'section'? 9 : 0)  // this goes wrong as it mutates

    // if starts with capital letter, pass through
    if(o.type.search(/^[A-Z]/) > -1) return munge(o.children[0], offset)

    const defaultInfo = R.contains(o.type, multiple)?
        {[o.type]: o.children.map(n=>munge(n, offset))}
        :{[o.type]: o.text}

    if(R.isNil(offset)) return defaultInfo

    return R.merge(defaultInfo, {
        start: o.start, // - offset,
        end: o.end, // - offset,
        errors: o.errors || []
    })
}
export function deMunge(o: NodeMinimal): Node {
    const type = getType(o)
    return R.contains(type, multiple)?
        {type: type, value: o[type].map(deMunge)}
        : {type: type, value: o[type]}
}
export function parser(s: string): NodeMinimal {
    return munge(basicParser(s), null)
}
export function fullParser(s: string): Section {
    return deMunge(munge(basicParser(s), null)) as Section
}

export function getType(o: NodeMinimal): string {
    if(R.isNil(o)) throw new UnableToDetermineTypeError(o)
    const intersection = R.intersection(Object.keys(o), Object.keys(types))
    if(intersection.length != 1) throw new UnableToDetermineTypeError(o)
    return intersection[0]
}
export function getValue(o: NodeMinimal){
    return o[getType(o)]
}

// repetitive enum-like definitions
export const baseOperators = {
    filter: 'filter',
    select: 'select',
    extend: 'extend',
    cross: 'cross',
    union: 'union',
    difference: 'difference',
    join: 'join',
    group: 'group',
}
export const baseOperatorMap = {
    filter: '>',
    select: 'v',
    extend: '^',
    cross: 'X',
    union: 'U',
    difference: '-',
    join: 'J',
    group: 'G',
}
export const baseOperatorInverseMap = R.invertObj(baseOperatorMap)
export const types = {
    section: 'section',
    let: 'let',
    def: 'def',
    line: 'line',
    aggregator: 'aggregator',
    map_macro: 'map_macro',

    all_headers: 'all_headers',
    relation: 'relation',
    to_one: 'to_one',
    to_many: 'to_many',
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

    // types used outside of parser
    function: 'function',
    headers: 'headers',
}
export const multiple = [
    types.section,
    types.let,
    types.def,
    types.line,
    types.aggregator,
    types.map_macro,

    types.named_value,

    types.relation_literal,
    types.rl_headers,
    types.rl_row,
    types.set,
]
export const is = {
    // multiple
    section: function(o: Node): o is Section {return o.type === types.section},
    let: function(o: Node): o is Let {return o.type === types.let},
    def: function(o: Node): o is Def {return o.type === types.def},
    line: function(o: Node): o is Line {return o.type === types.line},
    aggregator: function(o: Node): o is Aggregator {return o.type === types.aggregator},
    map_macro: function(o: Node): o is MapMacro {return o.type === types.map_macro},
    named_value: function(o: Node): o is NamedValue {return o.type === types.named_value},
    relation_literal: function(o: Node): o is RelationLiteral {return o.type === types.relation_literal},
    rl_headers: function(o: Node): o is RlHeaders {return o.type === types.rl_headers},
    rl_row: function(o: Node): o is RlRow {return o.type === types.rl_row},
    set: function(o: Node): o is Set {return o.type === types.set},
    // single
    all_headers: function(o: Node): o is AllHeaders {return o.type === types.all_headers},
    relation: function(o: Node): o is Relation {return o.type === types.relation},
    header: function(o: Node): o is Header {return o.type === types.header},
    var: function(o: Node): o is Var {return o.type === types.var},
    operator: function(o: Node): o is Operator {return o.type === types.operator},
    bool: function(o: Node): o is Bool {return o.type === types.bool},
    null: function(o: Node): o is Null {return o.type === types.null},
    number: function(o: Node): o is Number {return o.type === types.number},
    string: function(o: Node): o is String {return o.type === types.string},
    template: function(o: Node): o is Template {return o.type === types.template},
    decimal: function(o: Node): o is Decimal {return o.type === types.decimal},
    datetime: function(o: Node): o is Datetime {return o.type === types.datetime},
    function: function(o: Node): o is Function {return o.type === types.function},

    // compound
    multiple: function(o: Node): o is NodeMultiple {return R.contains(o.type, multiple)},
    letOrDef: (o: Node)=>is.let(o) || is.def(o),
    singleRelationOrVarOrSet: (o: Node)=>{
        const isLine = is.line(o)
        const isLength1 = o.value.length === 1
        const first = o.value[0] as Node
        return isLine && isLength1 &&
        (
            is.relation(first) ||
            is.var(first) ||
            is.set(first) ||
            is.all_headers(first)
        )
    },
    baseOperator: function(o: Node): o is Operator{
        return is.operator(o) &&
        R.contains(o.value, Object.keys(baseOperatorInverseMap))
    },
    groupOperator: (o: Node)=>
        is.operator(o) &&
        o.value === baseOperatorMap.group,
}
export class TypeError extends Error {constructor(type: string, node: NodeMinimal) {
    super(`Type error, node is not type ${type}: ${inspect(node)}`)
}}
export class ParserError extends Error {constructor() {
    super(`Parser fully failed`)
}}
export class UnableToDetermineTypeError extends Error {constructor(node: NodeMinimal) {
    super(`Unable to determine type of node: ${inspect(node)}`)
}}
const makeAsserter = (type: string)=>(o: Node)=>{
    if(!Object.keys(is).includes(type)) throw new TypeError(type, o)
    return o
}
export const assertIs = {
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
