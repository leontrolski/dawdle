const chai = require('chai')

const parser = require('../parser')

const assert = chai.assert
chai.config.includeStack = true
chai.config.truncateThreshold = 1000

describe('parser.addIndents', ()=>{
    it('should add sections and indents', ()=>{
        const in_ = `
a-1
a-2
    a-3
    a-4
        a-5
    a-6
        a-7

a-8
a-9

a-0
    a-1
        a-2

    a-3
        a-4
`
        const expected = `<SECTION>
a-1
a-2
<INDENT>
    a-3
    a-4
<INDENT>
        a-5
</INDENT>
    a-6
<INDENT>
        a-7
</INDENT>
</INDENT>
</SECTION>
<SECTION>
a-8
a-9
</SECTION>
<SECTION>
a-0
<INDENT>
    a-1
<INDENT>
        a-2
</INDENT>
</SECTION>
<SECTION>
    a-3
<INDENT>
        a-4
</INDENT>
</INDENT>
</SECTION>
`
        assert.deepEqual(expected, parser.addIndents(in_))
    })
})

describe('parser.parser', ()=>{
    it('should parse a single var', ()=>{
        const in_ = `some_var`
        const expected = {
            t: 'program',
            c: [{
                t: 'section',
                c: [{
                    t: 'line',
                    c: [{t: 'var', v: 'some_var'}]
                }]
            }],
        }
        assert.deepEqual(expected, parser.useful(parser.parser(in_)))
    })
    it('should parse a relation with a couple of operations', ()=>{
        const in_ = `
some_rel:
J other_rel:
| some_var other_var`
        const expected = [{
            t: 'section',
            c: [
                {
                    t: 'line',
                    c: [
                        {t: 'relation', v: 'some_rel:'},
                    ]
                },
                {
                    t: 'line',
                    c: [
                        {t: 'operator', v: 'J'},
                        {t: 'Value', c: {t: 'relation', v: 'other_rel:'}},
                    ]
                },
                {
                    t: 'line',
                    c: [
                        {t: 'operator', v: '|'},
                        {t: 'Value', c: {t: 'var', v: 'some_var'}},
                        {t: 'Value', c: {t: 'var', v: 'other_var'}},
                    ]
                },
            ]
        }]
        assert.deepEqual(expected, parser.useful(parser.parser(in_)).c)
    })
    it('should parse JSON literals | [templates set]', ()=>{
        const in_ = '| 1 -2 3.0 true null ["string" `template` ["sub_set"]] []'
        const expected = [{
            t: 'section',
            c: [
                {
                    t: 'line',
                    c: [
                        {t: 'operator', v: '|'},
                        {t: 'Value', c: {t: 'Literal', c: {t: 'number', v: '1'}}},
                        {t: 'Value', c: {t: 'Literal', c: {t: 'number', v: '-2'}}},
                        {t: 'Value', c: {t: 'Literal', c: {t: 'number', v: '3.0'}}},
                        {t: 'Value', c: {t: 'Literal', c: {t: 'bool', v: 'true'}}},
                        {t: 'Value', c: {t: 'Literal', c: {t: 'null', v: 'null'}}},
                        {t: 'Value', c: {t: 'set', c: [
                            {t: 'Value', c: {t: 'Literal', c: {t: 'string', v: '"string"'}}},
                            {t: 'Value', c: {t: 'Literal', c: {t: 'template', v: '`template`'}}},
                            {t: 'Value', c: {t: 'set', c: [
                                {t: 'Value', c: {t: 'Literal', c: {t: 'string', v: '"sub_set"'}}},
                            ]}},
                        ]}},
                        {t: 'Value', c: {t: 'set', v: "[]"}},
                    ]
                },
            ]
        }]
        assert.deepEqual(expected, parser.useful(parser.parser(in_)).c)
    })
    it('should parse blocks', ()=>{
        const in_ = `
a:
|
    a:
    J a:
X
    a:
    -
        a:

a:
`
        const a = {t: 'relation', v: 'a:'}
        const expected = [
            {t: 'section', c: [
                {t: 'line', c: [a]},
                {t: 'line', c: [{t: 'operator', v: '|'}]},
                {t: 'block', c: [
                    {t: 'line', c: [a]},
                    {t: 'line', c: [{t: 'operator', v: 'J'}, {t: 'Value', c: a}]},
                ]},
                {t: 'line', c: [{t: 'operator', v: 'X'}]},
                {t: 'block', c: [
                    {t: 'line', c: [a]},
                    {t: 'line', c: [{t: 'operator', v: '-'}]},
                    {t: 'block', c: [
                        {t: 'line', c: [a]},
                    ]},
                ]},
            ]},
            {t: 'section', c: [
                {t: 'line', c: [a]},
            ]},
        ]
        assert.deepEqual(expected, parser.useful(parser.parser(in_)).c)
    })
    it('should parse more blocks', ()=>{
        const in_ = `
- 1
    - 2

    - 4
`
        const expected = ''
        assert.deepEqual(expected, parser.addIndents(in_))
        // const expected = {}
        // assert.deepEqual(expected, parser.minimal(parser.parser(in_)))
    })
})

describe('parser.minimal', ()=>{
    it('should turn a raw AST into minimal form', ()=>{
        const in_ = `
a:
|
    a:
    J a:
X
    a:
    -
        a:

a:
- [3 "foo"]
`
        const expected = [
            {section: [
                {line: [{relation: 'a:'}]},
                {line: [{operator: '|'}]},
                {block: [
                    {line: [{relation: 'a:'}]},
                    {line: [{operator: 'J'}, {relation: 'a:'}]},
                ]},
                {line: [{operator: 'X'}]},
                {block: [
                    {line: [{relation: 'a:'}]},
                    {line: [{operator: '-'}]},
                    {block: [
                        {line: [{relation: 'a:'}]},
                    ]}]}]},
            {section: [
                {line: [{relation: 'a:'}]},
                {line: [{operator: '-'}, {set: [{number: '3'}, {string: '"foo"'}]}]}]}
        ]
        assert.deepEqual(expected, parser.minimal(parser.parser(in_)).program)
    })
})