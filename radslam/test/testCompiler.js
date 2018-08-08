const chai = require('chai')

const parser = require('../parser')
const compiler = require('../compiler')

const assert = chai.assert
chai.config.includeStack = true
chai.config.truncateThreshold = 1000

describe('compiler.compiler', ()=>{
    it('beginnings of a compiler-y thing', ()=>{
        const env = {
            make_null: ()=>({null: 'null'}),
            first: (relation)=>relation.rows[0],
        }
        const in_ = `def Outer relation: right:
    let joined:
        relation:
        J right:

    relation:
    -
        joined:
        v relation:*
    X
        right:
        > first
        (map right:*) \`^ \${_} make_null\`
    U joined:

let not_foo
    [:left_id :l]

| :left_id | :l | :nah | :foo |
-------------------------------
| 1        | 10 | 9    | 8    |
| 2        | 20 | 9    | 8    |
| 3        | 30 | 9    | 8    |
v :left_id :l :foo
v not_foo
Outer
    | :right_id | :left_id | :r |
    -----------------------------
    | 1         | 1        | 11 |
    | 2         | 1        | 12 |
    | 3         | 2        | 23 |
`
        // expecting to see:
        //
        // | :left_id | :l | :right_id | :r   |
        // ------------------------------------
        // | 1        | 10 | 1         | 11   |
        // | 1        | 10 | 2         | 12   |
        // | 2        | 20 | 3         | 23   |
        // | 3        | 30 | null      | null |
        const ast = parser.parser(in_)
        const expected = []
        // parser.log(parser.parser(in_))
        compiler.compiler(ast)
        // assert.deepEqual(expected, compiler.compiler(env, ast))
    })
})