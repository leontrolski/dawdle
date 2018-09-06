const chai = require('chai')

const parser = require('../parser')
const compiler = require('../compiler')

const assert = chai.assert
chai.config.includeStack = true
chai.config.truncateThreshold = 1000

// helper
const makeHeaders = (...headers) => headers.map(h=>({type: 'header', value: h}))

describe('compiler.compileHeaders', ()=>{
    it('should get the headers of a table literal', ()=>{
        const env = compiler.emptyEnv
        const in_ = `| :a | :b |`
        const ast = parser.fullParser(in_)
        const expected = {
            type: 'relation',
            headers: [{type: 'header', value: ':a'}, {type: 'header', value: ':b'}],
            accum: []
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should get the headers in a set literal', ()=>{
        const env = compiler.emptyEnv
        const in_ = `[:foo :bar]`
        const ast = parser.fullParser(in_)
        const expected = {
            type: 'set',
            value: [{type: 'header', value: ':foo'}, {type: 'header', value: ':bar'}],
            accum: [],
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should handle let assignment of a relation', ()=>{
        const env = compiler.emptyEnv
        const in_ = `let some_rel:
    | :a | :b |

some_rel:
`
        const ast = parser.fullParser(in_)
        const expected = {
            type: 'relation',
            headers: [{type: 'header', value: ':a'}, {type: 'header', value: ':b'}],
            accum: []
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should handle base operators at each step on a set', ()=>{
        const env = compiler.emptyEnv
        const in_ = `[1 2]
U [2 3 4]
- [2 4]`
        const ast = parser.fullParser(in_)
        const expected = {
            type: 'set',
            value: [{type: 'number', value: '1'}, {type: 'number', value: '3'}],
            accum: [
                {type: 'set', value: [{type: 'number', value: '1'}, {type: 'number', value: '2'}]},
                {type: 'set', value: [{type: 'number', value: '1'}, {type: 'number', value: '2'}, {type: 'number', value: '3'}, {type: 'number', value: '4'}]},
            ],
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should handle base operators at each step on a relation', ()=>{
        const env = {lets: {fake_function: {function: ()=>null}}}
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
        const ast = parser.fullParser(in_)
        const expected = {
            type: 'relation',
            headers: makeHeaders(':a', ':g', ':h'),
            accum: [
                {type: 'relation', headers: makeHeaders(':a', ':b', ':c')},
                {type: 'relation', headers: makeHeaders(':a', ':b', ':c', ':d')},
                {type: 'relation', headers: makeHeaders(':a', ':b', ':c', ':d')},
                {type: 'relation', headers: makeHeaders(':a', ':b', ':c', ':d', ':e')},
                {type: 'relation', headers: makeHeaders(':a', ':e')},
                {type: 'relation', headers: makeHeaders(':a', ':e', ':f')},
                {type: 'relation', headers: makeHeaders(':a', ':g', ':h')},
                {type: 'relation', headers: makeHeaders(':a', ':g', ':h')},
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
        const ast = parser.fullParser(in_)
        const expected = {
            type: 'relation',
            headers: makeHeaders(':a', ':b', ':c'),
            accum: [
                {type: 'relation', headers: makeHeaders(':a', ':b')},
            ],
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should expand map macros', ()=>{
        const env = {lets: {fake_function: {function: ()=>null}}}
        const in_ = `| :a |
(map [:foo :bar]) \`^ {{_}} fake_function\``
        const ast = parser.fullParser(in_)
        const expected = {
            type: 'relation',
            headers: makeHeaders(':a', ':foo', ':bar'),
            accum: [
                {type: 'relation', headers: makeHeaders(':a')},
            ],
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should do a load of nested stuff', ()=>{
        const env = {lets: {
            make_null: {function: (row, relation, ..._)=>({type: 'null', value: 'null'})},
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
        (map just_right_headers) \`^ {{_}} make_null\`
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
        const ast = parser.fullParser(in_)
        const expected = {
            type: 'relation',
            headers: makeHeaders(':left_id', ':l', ':right_id', ':r', ':new_header'),
            accum: [
                {
                    type: 'relation',
                    headers: makeHeaders(':left_id', ':l', ':nah', ':foo'),
                    accum: [
                        {type: 'relation', headers: makeHeaders(':left_id', ':l', ':nah')}
                    ]
                },
                {type: 'relation', headers: makeHeaders(':left_id', ':l', ':foo')},
                {type: 'relation', headers: makeHeaders(':left_id', ':l')},
                {
                    type: 'relation',
                    headers: makeHeaders(':left_id', ':l', ':right_id', ':r'),
                    accum: [
                        {type: 'relation', headers: makeHeaders(':left_id', ':l')},
                        {type: 'relation', headers: makeHeaders(':left_id', ':l')},
                        {type: 'relation', headers: makeHeaders(':left_id', ':l', ':right_id', ':r')},
                    ]
                },
            ]
        }
        assert.deepEqual(expected, compiler.compileHeaders(env, ast))
    })
    it('should reflect the shape of the ast', ()=>{
        const env = compiler.emptyEnv
        const in_ = `let some_rel:
    | :a | :b |

some_rel:
`
        const ast = parser.fullParser(in_)
        // console.log(parser.inspect(ast))
        const expected = {
            type: 'relation',
            headers: [{type: 'header', value: ':a'}, {type: 'header', value: ':b'}],
            accum: []
        }
        assert.deepEqual(expected, compiler.reflectAst(env, ast))
    })
})
