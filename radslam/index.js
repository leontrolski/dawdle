const R = require('ramda')

const parser = require('./parser')

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

`a_relation:

J
v 5 \`bar\`

> 4 "foo"
> 5
    X 6 x_fooooo1
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

const ast = parser.parser(s)
console.log(ast)
parser.logAst(ast)
