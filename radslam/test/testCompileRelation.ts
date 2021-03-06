import * as chai from 'chai'
import { describe, it } from 'mocha'

import * as parser from '../src/parser'
import * as compiler from '../src/compiler'
import * as stdlib from '../src/stdlib'
import { Node } from '../src/parser'

const assert = chai.assert
chai.config.includeStack = true
chai.config.truncateThreshold = 1000

describe('compiler.compiler relation', ()=>{
    xit('should allow assiging a literal with no operations', ()=>{
      const env = compiler.emptyEnv
      const in_ = `let foo:
    1

[]
`
      const ast = parser.fullParser(in_)
      const expected = { }

      assert.deepEqual(expected as Node, compiler.compiler(env, ast, false))
    })
    it('should resolve a value in a table literal', ()=>{
        const env = compiler.emptyEnv.merge([stdlib.makeValue('two', 2)])
        const in_ = `| :a | :b |
-----------
| 1 | two   |
`
        const ast = parser.fullParser(in_)
        const expected = { type: 'section',
            value:
            [ { type: 'relation_literal',
                value:
                [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] },
                    { type: 'rl_row', value: [ { type: 'number', value: '1' }, { type: 'var', value: 'two' } ] } ],
                compiledType: 'relation',
                compiledValue: { headers: [ 'a', 'b' ], rows: [ [ 1, 2 ] ] } } ],
            compiledType: 'relation',
            compiledValue: { headers: [ 'a', 'b' ], rows: [ [ 1, 2 ] ] } }

        assert.deepEqual(expected as Node, compiler.compiler(env, ast, false))
    })
    it('should get the headers of a table literal', ()=>{
        const env = compiler.emptyEnv
        const in_ = `let a:
    | :a | :b |
    -----------
    | 1 | 2   |
    | 2 | 4   |

let c:
    | :c | :a          |
    --------------------
    | 5  | 1           |
    | 6  | 1           |
    | 7  | ~2016-12-02 |

a:
J c:
v :b :c
`
        const ast = parser.fullParser(in_)
        const expected = { type: 'section',
        value:
         [ { type: 'let',
             value:
              [ { type: 'relation', value: 'a:' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value:
                        [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] },
                          { type: 'rl_row', value: [ { type: 'number', value: '1' }, { type: 'number', value: '2' } ] },
                          { type: 'rl_row', value: [ { type: 'number', value: '2' }, { type: 'number', value: '4' } ] } ],
                       compiledType: 'relation',
                       compiledValue: { headers: [ 'a', 'b' ], rows: [ [ 1, 2 ], [ 2, 4 ] ] } } ],
                  compiledType: 'relation',
                  compiledValue: { headers: [ 'a', 'b' ], rows: [ [ 1, 2 ], [ 2, 4 ] ] } } ] },
           { type: 'let',
             value:
              [ { type: 'relation', value: 'c:' },
                { type: 'section',
                  value:
                   [ { type: 'relation_literal',
                       value:
                        [ { type: 'rl_headers', value: [ { type: 'header', value: ':c' }, { type: 'header', value: ':a' } ] },
                          { type: 'rl_row', value: [ { type: 'number', value: '5' }, { type: 'number', value: '1' } ] },
                          { type: 'rl_row', value: [ { type: 'number', value: '6' }, { type: 'number', value: '1' } ] },
                          { type: 'rl_row', value: [ { type: 'number', value: '7' }, { type: "datetime", value: "~2016-12-02" } ] } ],
                       compiledType: 'relation',
                       compiledValue: { headers: [ 'c', 'a' ], rows: [ [ 5, 1 ], [ 6, 1 ], [ 7, { type: "datetime", value: "~2016-12-02" } ] ] } } ],
                  compiledType: 'relation',
                  compiledValue: { headers: [ 'c', 'a' ], rows: [ [ 5, 1 ], [ 6, 1 ], [ 7, { type: "datetime", value: "~2016-12-02" } ] ] } } ] },
           { type: 'line',
             value: [ { type: 'relation', value: 'a:' } ],
             compiledType: 'relation',
             compiledValue: { headers: [ 'a', 'b' ], rows: [ [ 1, 2 ], [ 2, 4 ] ] } },
           { type: 'line',
             value: [ { type: 'operator', value: 'J' }, { type: 'relation', value: 'c:' } ],
             compiledType: 'relation',
             compiledValue: { headers: [ 'a', 'b', 'c' ], rows: [ [ 1, 2, 5 ], [ 1, 2, 6 ] ] } },
           { type: 'line',
             value: [ { type: 'operator', value: 'v' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ],
             compiledType: 'relation',
             compiledValue: { headers: [ 'b', 'c' ], rows: [ [ 2, 5 ], [ 2, 6 ] ] } } ],
        compiledType: 'relation',
        compiledValue: { headers: [ 'b', 'c' ], rows: [ [ 2, 5 ], [ 2, 6 ] ] } }

        assert.deepEqual(expected as Node, compiler.compiler(env, ast, false))
    })
    it('should do group bys', ()=>{
        const in_ = `| :a | :b | :c |
-----------
| 1 | 1 | 2 |
| 1 | 2 | 3 |
| 2 | 1 | 5 |
| 2 | 1 | 6 |
| 1 | 1 | 7 |
| 3 | 1 | 8 |
G :a :b
    :sum_of_c sum :c
`
        const ast = parser.fullParser(in_)
        const expected = { type: 'section',
        value:
         [ { type: 'relation_literal',
             value:
              [ { type: 'rl_headers',
                  value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' }, { type: 'header', value: ':c' } ] },
                { type: 'rl_row',
                  value: [ { type: 'number', value: '1' }, { type: 'number', value: '1' }, { type: 'number', value: '2' } ] },
                { type: 'rl_row',
                  value: [ { type: 'number', value: '1' }, { type: 'number', value: '2' }, { type: 'number', value: '3' } ] },
                { type: 'rl_row',
                  value: [ { type: 'number', value: '2' }, { type: 'number', value: '1' }, { type: 'number', value: '5' } ] },
                { type: 'rl_row',
                  value: [ { type: 'number', value: '2' }, { type: 'number', value: '1' }, { type: 'number', value: '6' } ] },
                { type: 'rl_row',
                  value: [ { type: 'number', value: '1' }, { type: 'number', value: '1' }, { type: 'number', value: '7' } ] },
                { type: 'rl_row',
                  value: [ { type: 'number', value: '3' }, { type: 'number', value: '1' }, { type: 'number', value: '8' } ] } ],
             compiledType: 'relation',
             compiledValue:
              { headers: [ 'a', 'b', 'c' ],
                rows: [ [ 1, 1, 2 ], [ 1, 2, 3 ], [ 2, 1, 5 ], [ 2, 1, 6 ], [ 1, 1, 7 ], [ 3, 1, 8 ] ] } },
           { type: 'line',
             value:
              [ { type: 'operator', value: 'G' },
                { type: 'header', value: ':a' },
                { type: 'header', value: ':b' },
                { type: 'section',
                  value:
                   [ { type: 'aggregator',
                       value:
                        [ { type: 'header', value: ':sum_of_c' },
                          { type: 'var', value: 'sum' },
                          { type: 'header', value: ':c' } ] } ] } ],
             compiledType: 'relation',
             compiledValue: { headers: [ 'a', 'b', 'sum_of_c' ], rows: [ [ 1, 1, 9 ], [ 1, 2, 3 ], [ 2, 1, 11 ], [ 3, 1, 8 ] ] } } ],
        compiledType: 'relation',
        compiledValue: { headers: [ 'a', 'b', 'sum_of_c' ], rows: [ [ 1, 1, 9 ], [ 1, 2, 3 ], [ 2, 1, 11 ], [ 3, 1, 8 ] ] } }

        assert.deepEqual(expected as Node, compiler.compiler(stdlib.env, ast, false))
    })
    it('should do extend', ()=>{
        const in_ = `| :a | :b |
---------
| 2 | 3 |
| 4 | 5 |
^ :c multiply :a 2 :b
`
        const ast = parser.fullParser(in_)
        const expected = { type: 'section',
            value:
            [ { type: 'relation_literal',
                value:
                [ { type: 'rl_headers', value: [ { type: 'header', value: ':a' }, { type: 'header', value: ':b' } ] },
                    { type: 'rl_row', value: [ { type: 'number', value: '2' }, { type: 'number', value: '3' } ] },
                    { type: 'rl_row', value: [ { type: 'number', value: '4' }, { type: 'number', value: '5' } ] } ],
                compiledType: 'relation',
                compiledValue: { headers: [ 'a', 'b' ], rows: [ [ 2, 3 ], [ 4, 5 ] ] } },
            { type: 'line',
                value:
                [ { type: 'operator', value: '^' },
                    { type: 'header', value: ':c' },
                    { type: 'var', value: 'multiply' },
                    { type: 'header', value: ':a' },
                    { type: 'number', value: '2' },
                    { type: 'header', value: ':b' } ],
                compiledType: 'relation',
                compiledValue: { headers: [ 'a', 'b', 'c' ], rows: [ [ 2, 3, 12 ], [ 4, 5, 40 ] ] } } ],
            compiledType: 'relation',
            compiledValue: { headers: [ 'a', 'b', 'c' ], rows: [ [ 2, 3, 12 ], [ 4, 5, 40 ] ] } }

        assert.deepEqual(expected as Node, compiler.compiler(stdlib.env, ast, false))
    })
    it('should do a plain rank', ()=>{
        const in_ = `| :a | :b | :c |
-----------
| 1 | 1 | 6 |
| 2 | 1 | 5 |
| 3 | 2 | 4 |
| 4 | 2 | 3 |
| 5 | 3 | 2 |
| 6 | 1 | 5 |
^ :c_asc rank :c
`
        const ast = parser.fullParser(in_)
        const expected = {
            headers: [ 'a', 'b', 'c', 'c_asc' ],
            rows: [
                [ 5, 3, 2, 0 ],
                [ 4, 2, 3, 1 ],
                [ 3, 2, 4, 2 ],
                [ 2, 1, 5, 3 ],
                [ 6, 1, 5, 3 ],
                [ 1, 1, 6, 4 ],
            ]
        }
        assert.deepEqual(expected, compiler.compiler(stdlib.env, ast, false).compiledValue)
    })
    it('should do a desc rank', ()=>{
        const in_ = `| :a | :b | :c |
-----------
| 1 | 1 | 6 |
| 2 | 1 | 5 |
| 3 | 2 | 4 |
| 4 | 2 | 3 |
| 5 | 3 | 2 |
| 6 | 1 | 5 |
^ :c_desc rank :c desc=true
`
        const ast = parser.fullParser(in_)
        const expected = {
            headers: [ 'a', 'b', 'c', 'c_desc' ],
            rows: [
                [ 1, 1, 6, 0 ],
                [ 2, 1, 5, 1 ],
                [ 6, 1, 5, 1 ],
                [ 3, 2, 4, 2 ],
                [ 4, 2, 3, 3 ],
                [ 5, 3, 2, 4 ],
            ]
        }
        assert.deepEqual(expected, compiler.compiler(stdlib.env, ast, false).compiledValue)
    })
    it('should do a desc rank over multiple columns', ()=>{
        const in_ = `| :a | :b | :c |
-----------
| 1 | 1 | 6 |
| 2 | 1 | 5 |
| 3 | 2 | 4 |
| 4 | 2 | 3 |
| 5 | 3 | 2 |
| 6 | 1 | 5 |
^ :c_then_a_desc rank :c :a desc=true
`
        const ast = parser.fullParser(in_)
        const expected = {
            headers: [ 'a', 'b', 'c', 'c_then_a_desc' ],
            rows: [
                [ 1, 1, 6, 0 ],
                [ 6, 1, 5, 1 ],
                [ 2, 1, 5, 2 ],
                [ 3, 2, 4, 3 ],
                [ 4, 2, 3, 4 ],
                [ 5, 3, 2, 5 ],
            ]
        }
        assert.deepEqual(expected, compiler.compiler(stdlib.env, ast, false).compiledValue)
    })
    it('should do a partitioned rank', ()=>{
        const in_ = `| :a | :b | :c |
-----------
| 1 | 1 | 6 |
| 2 | 1 | 5 |
| 3 | 2 | 4 |
| 4 | 2 | 3 |
| 5 | 3 | 2 |
| 6 | 1 | 5 |
^ :c_per_b rank :c partition_by=:b
`
        const ast = parser.fullParser(in_)
        const expected = {
            headers: [ 'a', 'b', 'c', 'c_per_b' ],
            rows: [
                [ 2, 1, 5, 0 ],
                [ 6, 1, 5, 0 ],
                [ 1, 1, 6, 1 ],
                [ 4, 2, 3, 0 ],
                [ 3, 2, 4, 1 ],
                [ 5, 3, 2, 0 ],
            ]
        }
        assert.deepEqual(expected, compiler.compiler(stdlib.env, ast, false).compiledValue)
    })
})