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
        const expected = { type: 'section',
            value:
            [ { type: 'relation_literal',
                value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] } ],
                compiledType: 'headers',
                compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] } ],
            compiledType: 'headers',
            compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] }

        assert.deepEqual(expected, compiler.compiler(env, ast))
    })
    it('should get the headers in a set literal', ()=>{
        const env = compiler.emptyEnv
        const in_ = `[:foo :bar]`
        const ast = parser.fullParser(in_)
        const expected = { type: 'section',
            value:
            [ { type: 'line',
                value: [ { type: 'set', value: [ { type: 'header', value: ':foo' }, { type: 'header', value: ':bar' } ] } ],
                compiledType: 'set',
                compiledValue: [ { type: 'header', value: ':foo' }, { type: 'header', value: ':bar' } ] } ],
            compiledType: 'set',
            compiledValue: [ { type: 'header', value: ':foo' }, { type: 'header', value: ':bar' } ] }

        assert.deepEqual(expected, compiler.compiler(env, ast))
    })
    it('should handle let assignment of a relation', ()=>{
        const env = compiler.emptyEnv
        const in_ = `let some_rel:
    | :a | :b |

some_rel:
`
        const ast = parser.fullParser(in_)
        const expected = { type: 'section',
            value:
            [ { type: 'let',
                value:
                [ { type: 'relation', value: 'some_rel:' },
                    { type: 'section',
                    value:
                    [ { type: 'relation_literal',
                        value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] } ],
                        compiledType: 'headers',
                        compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] } ],
                    compiledType: 'headers',
                    compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] } ] },
            { type: 'line',
                value: [ { type: 'relation', value: 'some_rel:' } ],
                compiledType: 'headers',
                compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] } ],
            compiledType: 'headers',
            compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] }

        assert.deepEqual(expected, compiler.compiler(env, ast))
    })
    it('should handle base operators at each step on a set', ()=>{
        const env = compiler.emptyEnv
        const in_ = `[1 2]
U [2 3 4]
- [2 4]`
        const ast = parser.fullParser(in_)
        const expected = { type: 'section',
            value:
            [ { type: 'line',
                value: [ { type: 'set', value: [ { type: 'number', value: '1' }, { type: 'number', value: '2' } ] } ],
                compiledType: 'set',
                compiledValue: [ { type: 'number', value: '1' }, { type: 'number', value: '2' } ] },
            { type: 'line',
                value:
                [ { type: 'operator', value: 'U' },
                    { type: 'set',
                    value: [ { type: 'number', value: '2' }, { type: 'number', value: '3' }, { type: 'number', value: '4' } ] } ],
                compiledType: 'set',
                compiledValue:
                [ { type: 'number', value: '1' },
                    { type: 'number', value: '2' },
                    { type: 'number', value: '3' },
                    { type: 'number', value: '4' } ] },
            { type: 'line',
                value:
                [ { type: 'operator', value: '-' },
                    { type: 'set', value: [ { type: 'number', value: '2' }, { type: 'number', value: '4' } ] } ],
                compiledType: 'set',
                compiledValue: [ { type: 'number', value: '1' }, { type: 'number', value: '3' } ] } ],
            compiledType: 'set',
            compiledValue: [ { type: 'number', value: '1' }, { type: 'number', value: '3' } ] }

        assert.deepEqual(expected, compiler.compiler(env, ast))
    })
    it('should handle base operators at each step on a relation', ()=>{
        const env = {lets: {fake_function: {type: 'function', value: ()=>null}}}
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
        const expected = { type: 'section',
        value:
         [ { type: 'relation_literal',
             value:
              [ { type: 'rl_headers',
                  value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: 'J' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':d' }, { type: 'header', value: ':a' } ] } ],
                       compiledType: 'headers',
                       compiledValue: [ { type: 'header', value: ':d' }, { type: 'header', value: ':a' } ] } ],
                  compiledType: 'headers',
                  compiledValue: [ { type: 'header', value: ':d' }, { type: 'header', value: ':a' } ] } ],
             compiledType: 'headers',
             compiledValue:
              [ { type: 'header', value: ':a' },
                { type: 'header', value: ':b' },
                { type: 'header', value: ':c' },
                { type: 'header', value: ':d' } ] },
           { type: 'line',
             value: [ { type: 'operator', value: '>' }, { type: 'var', value: 'fake_function' } ],
             compiledType: 'headers',
             compiledValue:
              [ { type: 'header', value: ':a' },
                { type: 'header', value: ':b' },
                { type: 'header', value: ':c' },
                { type: 'header', value: ':d' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: '^' },
                { type: 'header', value: ':e' },
                { type: 'var', value: 'fake_function' } ],
             compiledType: 'headers',
             compiledValue:
              [ { type: 'header', value: ':a' },
                { type: 'header', value: ':b' },
                { type: 'header', value: ':c' },
                { type: 'header', value: ':d' },
                { type: 'header', value: ':e' } ] },
           { type: 'line',
             value: [ { type: 'operator', value: 'v' }, { type: 'header', value: ':a' }, { type: 'header', value: ':e' } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':e' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: 'X' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':f' } ] } ],
                       compiledType: 'headers',
                       compiledValue: [ { type: 'header', value: ':f' } ] } ],
                  compiledType: 'headers',
                  compiledValue: [ { type: 'header', value: ':f' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':e' }, { type: 'header', value: ':f' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: 'G' },
                { type: 'header', value: ':a' },
                { type: 'aggregator',
                  value: [ { type: 'header', value: ':g' }, { type: 'var', value: 'some_function' } ],
                  compiledValue: [ { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: '-' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value:
                        [ { type: 'rl_headers',
                            value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] } ],
                       compiledType: 'headers',
                       compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] } ],
                  compiledType: 'headers',
                  compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: 'U' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value:
                        [ { type: 'rl_headers',
                            value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] } ],
                       compiledType: 'headers',
                       compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] } ],
                  compiledType: 'headers',
                  compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] } ],
        compiledType: 'headers',
        compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':g' }, { type: 'header', value: ':h' } ] }

        assert.deepEqual(expected, compiler.compiler(env, ast))
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
        const expected = { type: 'section',
        value:
         [ { type: 'def',
             value:
              [ { type: 'operator', value: 'JoinClone' },
                { type: 'relation', value: 'relation:' },
                { type: 'relation', value: 'right:' },
                { type: 'section',
                  value:
                   [ { type: 'line', value: [ { type: 'relation', value: 'relation:' } ] },
                     { type: 'line', value: [ { type: 'operator', value: 'J' }, { type: 'relation', value: 'right:' } ] } ] } ] },
           { type: 'relation_literal',
             value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: 'JoinClone' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':c' } ] } ],
                       compiledType: 'headers',
                       compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':c' } ] } ],
                  compiledType: 'headers',
                  compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':c' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] } ],
        compiledType: 'headers',
        compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] }

        assert.deepEqual(expected, compiler.compiler(env, ast))
    })
    it('should expand map macros', ()=>{
        const env = {lets: {fake_function: {type: 'function', value: ()=>null}}}
        const in_ = `| :a |
(map [:foo :bar]) \`^ {{_}} fake_function\`
`
        const ast = parser.fullParser(in_)
        const expected = { type: 'section',
        value:
         [ { type: 'relation_literal',
             value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' } ] },
           { type: 'map_macro',
             value:
                [ { type: 'set', value: [ { type: 'header', value: ':foo' }, { type: 'header', value: ':bar' } ] },
                { type: 'template', value: '`^ {{_}} fake_function`' } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':foo' }, { type: 'header', value: ':bar' } ] } ],
        compiledType: 'headers',
        compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':foo' }, { type: 'header', value: ':bar' } ] }

        assert.deepEqual(expected, compiler.compiler(env, ast))
    })
    it('should show the values for two nested joins', ()=>{
        const env = compiler.emptyEnv
        const in_ = `| :a |
J
    | :a | :b |
    J
        | :b | :c |
`
        const ast = parser.fullParser(in_)
        const expected = { type: 'section',
        value:
         [ { type: 'relation_literal',
             value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: 'J' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] } ],
                       compiledType: 'headers',
                       compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] },
                     { type: 'line',
                       value:
                        [ { type: 'operator', value: 'J' },
                          { type: 'section',
                            value:
                             [ { type: 'relation_literal',
                                 value: [ { type: 'rl_headers', value: [ { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] } ],
                                 compiledType: 'headers',
                                 compiledValue: [ { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] } ],
                            compiledType: 'headers',
                            compiledValue: [ { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] } ],
                       compiledType: 'headers',
                       compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] } ],
                  compiledType: 'headers',
                  compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] } ],
        compiledType: 'headers',
        compiledValue: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] }

        assert.deepEqual(expected, compiler.compiler(env, ast))
    })
    it('should do a load of nested stuff', ()=>{
        const env = {lets: {
            make_null: {type: 'function', value: (row, relation, ..._)=>({type: 'null', value: 'null'})},
            first: {type: 'function', value: (row, relation, ..._)=>relation.rows[0]},
            value: {type: 'function', value: (row, relation, value)=>value},
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
        const expected = { type: 'section',
        value:
         [ { type: 'def',
             value:
              [ { type: 'operator', value: 'Outer' },
                { type: 'relation', value: 'relation:' },
                { type: 'relation', value: 'right:' },
                { type: 'section',
                  value:
                   [ { type: 'let',
                       value:
                        [ { type: 'relation', value: 'joined:' },
                          { type: 'section',
                            value:
                             [ { type: 'line', value: [ { type: 'relation', value: 'relation:' } ] },
                               { type: 'line', value: [ { type: 'operator', value: 'J' }, { type: 'relation', value: 'right:' } ] } ] } ] },
                     { type: 'let',
                       value:
                        [ { type: 'var', value: 'just_right_headers' },
                          { type: 'section',
                            value:
                             [ { type: 'line', value: [ { type: 'all_headers', value: 'right:*' } ] },
                               { type: 'line',
                                 value: [ { type: 'operator', value: '-' }, { type: 'all_headers', value: 'relation:*' } ] } ] } ] },
                     { type: 'line', value: [ { type: 'relation', value: 'relation:' } ] },
                     { type: 'line',
                       value:
                        [ { type: 'operator', value: '-' },
                          { type: 'section',
                            value:
                             [ { type: 'line', value: [ { type: 'relation', value: 'joined:' } ] },
                               { type: 'line',
                                 value: [ { type: 'operator', value: 'v' }, { type: 'all_headers', value: 'relation:*' } ] } ] } ] },
                     { type: 'line',
                       value:
                        [ { type: 'operator', value: 'X' },
                          { type: 'section',
                            value:
                             [ { type: 'line', value: [ { type: 'relation', value: 'right:' } ] },
                               { type: 'line', value: [ { type: 'operator', value: '>' }, { type: 'var', value: 'first' } ] },
                               { type: 'line',
                                 value: [ { type: 'operator', value: 'v' }, { type: 'var', value: 'just_right_headers' } ] },
                               { type: 'map_macro',
                                 value: [ { type: 'var', value: 'just_right_headers' }, { type: 'template', value: '`^ {{_}} make_null`' } ] } ] } ] },
                     { type: 'line', value: [ { type: 'operator', value: 'U' }, { type: 'relation', value: 'joined:' } ] } ] } ] },
           { type: 'let',
             value:
              [ { type: 'var', value: 'not_foo' },
                { type: 'section',
                  value:
                   [ { type: 'line',
                       value: [ { type: 'set', value: [ { type: 'header', value: ':left_id' } ] } ],
                       compiledType: 'set',
                       compiledValue: [ { type: 'header', value: ':left_id' } ] },
                     { type: 'line',
                       value: [ { type: 'operator', value: 'U' }, { type: 'set', value: [ { type: 'header', value: ':l' } ] } ],
                       compiledType: 'set',
                       compiledValue: [ { type: 'header', value: ':left_id' }, { type: 'header', value: ':l' } ] } ],
                  compiledType: 'set',
                  compiledValue: [ { type: 'header', value: ':left_id' }, { type: 'header', value: ':l' } ] } ] },
           { type: 'let',
             value:
              [ { type: 'relation', value: 'left:' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value:
                        [ { type: 'rl_headers',
                            value:
                             [ { type: 'header', value: ':left_id' },
                               { type: 'header', value: ':l' },
                               { type: 'header', value: ':nah' } ] },
                          { type: 'rl_row',
                            value: [ { type: 'number', value: '1' }, { type: 'number', value: '10' }, { type: 'number', value: '9' } ] },
                          { type: 'rl_row',
                            value: [ { type: 'number', value: '2' }, { type: 'number', value: '20' }, { type: 'number', value: '9' } ] },
                          { type: 'rl_row',
                            value: [ { type: 'number', value: '3' }, { type: 'number', value: '30' }, { type: 'number', value: '9' } ] } ],
                       compiledType: 'headers',
                       compiledValue:
                        [ { type: 'header', value: ':left_id' },
                          { type: 'header', value: ':l' },
                          { type: 'header', value: ':nah' } ] },
                     { type: 'line',
                       value:
                        [ { type: 'operator', value: '^' },
                          { type: 'header', value: ':foo' },
                          { type: 'var', value: 'value' },
                          { type: 'number', value: '8' } ],
                       compiledType: 'headers',
                       compiledValue:
                        [ { type: 'header', value: ':left_id' },
                          { type: 'header', value: ':l' },
                          { type: 'header', value: ':nah' },
                          { type: 'header', value: ':foo' } ] } ],
                  compiledType: 'headers',
                  compiledValue:
                   [ { type: 'header', value: ':left_id' },
                     { type: 'header', value: ':l' },
                     { type: 'header', value: ':nah' },
                     { type: 'header', value: ':foo' } ] } ] },
           { type: 'line',
             value: [ { type: 'relation', value: 'left:' } ],
             compiledType: 'headers',
             compiledValue:
              [ { type: 'header', value: ':left_id' },
                { type: 'header', value: ':l' },
                { type: 'header', value: ':nah' },
                { type: 'header', value: ':foo' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: 'v' },
                { type: 'header', value: ':left_id' },
                { type: 'header', value: ':l' },
                { type: 'header', value: ':foo' } ],
             compiledType: 'headers',
             compiledValue:
              [ { type: 'header', value: ':left_id' },
                { type: 'header', value: ':l' },
                { type: 'header', value: ':foo' } ] },
           { type: 'line',
             value: [ { type: 'operator', value: 'v' }, { type: 'var', value: 'not_foo' } ],
             compiledType: 'headers',
             compiledValue: [ { type: 'header', value: ':left_id' }, { type: 'header', value: ':l' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: 'Outer' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value:
                        [ { type: 'rl_headers',
                            value:
                             [ { type: 'header', value: ':right_id' },
                               { type: 'header', value: ':left_id' },
                               { type: 'header', value: ':r' } ] },
                          { type: 'rl_row',
                            value: [ { type: 'number', value: '1' }, { type: 'number', value: '1' }, { type: 'number', value: '11' } ] },
                          { type: 'rl_row',
                            value: [ { type: 'number', value: '2' }, { type: 'number', value: '1' }, { type: 'number', value: '12' } ] },
                          { type: 'rl_row',
                            value: [ { type: 'number', value: '3' }, { type: 'number', value: '2' }, { type: 'number', value: '23' } ] } ] ,
                            compiledType: "headers",
                                      compiledValue: [
                                        {
                                          type: "header",
                                          value: ":right_id",
                                        },
                                        {
                                          type: "header",
                                          value: ":left_id",
                                        },
                                        {
                                          type: "header",
                                          value: ":r",
                                        },
                                      ],
                                    },
                                ],
                                compiledType: "headers",
                                compiledValue: [
                                  {
                                    type: "header",
                                    value: ":right_id",
                                  },
                                  {
                                    type: "header",
                                    value: ":left_id",
                                  },
                                  {
                                    type: "header",
                                    value: ":r",
                                  },
                                ],

                } ],
             compiledType: 'headers',
             compiledValue:
              [ { type: 'header', value: ':left_id' },
                { type: 'header', value: ':l' },
                { type: 'header', value: ':right_id' },
                { type: 'header', value: ':left_id' },
                { type: 'header', value: ':r' } ] },
           { type: 'line',
             value:
              [ { type: 'operator', value: '^' },
                { type: 'header', value: ':new_header' },
                { type: 'var', value: 'value' },
                { type: 'number', value: '9' } ],
             compiledType: 'headers',
             compiledValue:
              [ { type: 'header', value: ':left_id' },
                { type: 'header', value: ':l' },
                { type: 'header', value: ':right_id' },
                { type: 'header', value: ':r' },
                { type: 'header', value: ':new_header' } ] } ],
        compiledType: 'headers',
        compiledValue:
         [ { type: 'header', value: ':left_id' },
           { type: 'header', value: ':l' },
           { type: 'header', value: ':right_id' },
           { type: 'header', value: ':r' },
           { type: 'header', value: ':new_header' } ] }
        assert.deepEqual(expected, compiler.compiler(env, ast))
    })
})