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
      // console.log(parser.inspect(compiler.compiler(env, ast, false)))
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
})