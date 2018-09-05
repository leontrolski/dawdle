const chai = require('chai')

const parser = require('../parser')
const compiler = require('../compiler')

const assert = chai.assert
chai.config.includeStack = true
chai.config.truncateThreshold = 1000


describe('compiler.compileHeaders', ()=>{
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
        const expected = {set: [{header: ':foo'}, {header: ':bar'}], accum: []}
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
    it('should handle base operators at each step on a set', ()=>{
        const env = compiler.emptyEnv
        const in_ = `[1 2]
U [2 3 4]
- [2 4]`
        const ast = parser.parser(in_)
        const expected = {
            set: [{number: '1'}, {number: '3'}],
            accum: [
                {set: [{number: '1'}, {number: '2'}]},
                {set: [{number: '1'}, {number: '2'}, {number: '3'}, {number: '4'}]},
            ],
        }
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
        const env = {vars: {fake_function: {function: ()=>null}}}
        const in_ = `| :a |
(map [:foo :bar]) \`^ :{{_}} fake_function\``
        const ast = parser.parser(in_)
        const expected = {
            relation: null, headers: [{header: ':a'}, {header: ':foo'}, {header: ':bar'}],
            accum: [
                {relation: null, headers: [{header: ':a'}]},
            ],
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should do a load of nested stuff', ()=>{
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
        right:*
        - relation:*

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
    [:left_id]
    U [:l]

let left:
    | :left_id | :l | :nah |
    ------------------------
    | 1        | 10 | 9    |
    | 2        | 20 | 9    |
    | 3        | 30 | 9    |
    ^ :foo value 8

left:
v :left_id :l :foo
v not_foo
Outer
    | :right_id | :left_id | :r |
    -----------------------------
    | 1         | 1        | 11 |
    | 2         | 1        | 12 |
    | 3         | 2        | 23 |
^ :new_header value 9
`
        // expecting to see:
        //
        // | :left_id | :l | :right_id | :r   | :new_header |
        // --------------------------------------------------
        // | 1        | 10 | 1         | 11   | 9           |
        // | 1        | 10 | 2         | 12   | 9           |
        // | 2        | 20 | 3         | 23   | 9           |
        // | 3        | 30 | null      | null | 9           |
        const ast = parser.parser(in_)
        const expected = {
            relation: null,
            headers: [{header: ':left_id' }, {header: ':l' }, {header: ':right_id' }, {header: ':r' }, {header: ':new_header' }],
            accum: [
               {relation: null, headers: [{header: ':left_id'}, {header: ':l'}, {header: ':nah'}, {header: ':foo'}],
                accum: [
                    {relation: null, headers: [{header: ':left_id'}, {header: ':l'}, {header: ':nah'}]}
                ]},
               {relation: null, headers: [{header: ':left_id'}, {header: ':l'}, {header: ':foo'}]},
               {relation: null, headers: [{header: ':left_id'}, {header: ':l'}]},
               {relation: null, headers: [{header: ':left_id'}, {header: ':l'}, {header: ':right_id'}, {header: ':r'}],
                accum: [
                    {relation: null, headers: [{header: ':left_id'}, {header: ':l'}]},
                    {relation: null, headers: [{header: ':left_id'}, {header: ':l'}]},
                    {relation: null, headers: [{header: ':left_id'}, {header: ':l'}, {header: ':right_id'}, {header: ':r'}]}
                ]},
            ]
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
})