const chai = require('chai')

const parser = require('../parser')
const compiler = require('../compiler')

const assert = chai.assert
chai.config.includeStack = true
chai.config.truncateThreshold = 1000


describe('compiler.compiler', ()=>{
    it('beginnings of a compiler-y thing', ()=>{
        const env = {vars: {
            make_null: {function: (row, relation, ..._)=>({null: 'null'})},
            first: {function: (row, relation, ..._)=>relation.rows[0]},
            value: {function: (row, relation, value)=>value},
        }}
        const in_ = `def Outer relation: right:
    let joined:
        relation:
        J right:

    let just_right_headers
        [:right_id :r]
        - :r

    relation:
    -
        joined:
        v relation:*
    X
        right:
        > first
        v just_right_headers
        (map just_right_headers) \`^ :{{_}} make_null\`
    U joined:

let not_foo
    [:left_id :l]

let left:
    | :left_id | :l | :nah | :foo |
    -------------------------------
    | 1        | 10 | 9    | 8    |
    | 2        | 20 | 9    | 8    |
    | 3        | 30 | 9    | 8    |

left:
v :left_id :l :foo
v not_foo
Outer
    | :right_id | :left_id | :r |
    -----------------------------
    | 1         | 1        | 11 |
    | 2         | 1        | 12 |
    | 3         | 2        | 23 |
^ :new_header value 8
`
        // expecting to see:
        //
        // | :left_id | :l | :right_id | :r   | :new_header |
        // --------------------------------------------------
        // | 1        | 10 | 1         | 11   | 8           |
        // | 1        | 10 | 2         | 12   | 8           |
        // | 2        | 20 | 3         | 23   | 8           |
        // | 3        | 30 | null      | null | 8           |
        const ast = parser.parser(in_)
        const expected = []
        // parser.log(ast)
        compiler.compileHeaders(env, ast)
        console.log(compiler.compileHeaders(env, ast))
        // assert.deepEqual(expected, compiler.compiler(env, ast))
    })
    it('should get the headers of a table literal', ()=>{
        const env = compiler.emptyEnv
        const in_ = `| :a | :b |`
        const ast = parser.parser(in_)
        const expected = {relation: null, headers: [{header: ':a'}, {header: ':b'}], accum: []}
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should get the headers in a set literal', ()=>{
        const env = compiler.emptyEnv
        const in_ = `[:foo :bar]`
        const ast = parser.parser(in_)
        const expected = {set: [{header: ':foo'}, {header: ':bar'}]}
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should handle let assignment of a relation', ()=>{
        const env = compiler.emptyEnv
        const in_ = `let some_rel:
    | :a | :b |

some_rel:
`
        const ast = parser.parser(in_)
        const expected = {relation: null, headers: [{header: ':a'}, {header: ':b'}], accum: []}
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    xit('should handle base operators at each step on a set', ()=>{
        const env = compiler.emptyEnv
        const in_ = `[:foo :bar]`
        const ast = parser.parser(in_)
        const expected = {set: [{header: ':foo'}, {header: ':bar'}]}
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should handle base operators at each step on a relation', ()=>{
        const env = {vars: {fake_function: {function: ()=>null}}}
        const in_ = `| :a | :b | :c |
J
    | :d | :a |
> fake_function
^ :e fake_function
v :a :e
X
    | :f |
G :a
    :g some_function
    :h some_function
-
    | :a | :g | :h |
U
    | :a | :g | :h |
`
        const ast = parser.parser(in_)
        const expected = {
            relation: null, headers: [{header: ':a'}, {header: ':g'}, {header: ':h'}],
            accum: [
                {relation: null, headers: [{header: ':a'}, {header: ':b'}, {header: ':c'}]},
                {relation: null, headers: [{header: ':a'}, {header: ':b'}, {header: ':c'}, {header: ':d'}]},
                {relation: null, headers: [{header: ':a'}, {header: ':b'}, {header: ':c'}, {header: ':d'}]},
                {relation: null, headers: [{header: ':a'}, {header: ':b'}, {header: ':c'}, {header: ':d'}, {header: ':e'}]},
                {relation: null, headers: [{header: ':a'}, {header: ':e'}]},
                {relation: null, headers: [{header: ':a'}, {header: ':e'}, {header: ':f'}]},
                {relation: null, headers: [{header: ':a'}, {header: ':g'}, {header: ':h'}]},
                {relation: null, headers: [{header: ':a'}, {header: ':g'}, {header: ':h'}]},
            ],
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should handle a simple composite operator', ()=>{
        const env = compiler.emptyEnv
        const in_ = `def JoinClone relation: right:
    relation:
    J right:

| :a | :b |
JoinClone
    | :a | :c |
`
        const ast = parser.parser(in_)
        const expected = {
            relation: null, headers: [{header: ':a'}, {header: ':b'}, {header: ':c'}],
            accum: [
                {relation: null, headers: [{header: ':a'}, {header: ':b'}]},
            ],
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should expand map macros', ()=>{
        const env = compiler.emptyEnv
        const in_ = `[:foo :bar]`
        const ast = parser.parser(in_)
        const expected = {set: [{header: ':foo'}, {header: ':bar'}]}
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
})