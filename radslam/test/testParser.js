const chai = require('chai')

const parser = require('../parser')

const assert = chai.assert
chai.config.includeStack = true
chai.config.truncateThreshold = 1000

describe('parser.addIndents', ()=>{
    it('should add sections and indents', ()=>{
        const in_ = `a-1
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
        const expected = `a-1
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

a-8
a-9

a-0
<INDENT>
    a-1
<INDENT>
        a-2
</INDENT>

    a-3
<INDENT>
        a-4
</INDENT>
</INDENT>
`
        assert.deepEqual(expected, parser.addIndents(in_))
    })
})

describe('parser.parser', ()=>{
    it('should parse a single var', ()=>{
        const in_ = `some_var`
        const expected = {section: [{line: [{var: 'some_var'}]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse a relation with a few operations', ()=>{
        const in_ = `some_rel:
J other_rel: :namespace.some-header
U some_var named=1.0
Custom other_other_rel:*
(map foo) \`yo\``
        const expected = {section: [
            {line: [{relation: 'some_rel:'}]},
            {line: [{operator: 'J'}, {relation: 'other_rel:'}, {header: ':namespace.some-header'}]},
            {line: [{operator: 'U'}, {var: 'some_var'}, {named_value: [{var: 'named'}, {number: '1.0'}]}]},
            {line: [{operator: 'Custom'}, {all_headers: 'other_other_rel:*'}]},
            {map_macro: [{var: 'foo'}, {template: "`yo`"}]},
        ]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse JSON literals U [templates set]', ()=>{
        const in_ = 'U 1 -2 3.0 true null $4.63 $-5 ~2018-08-02T09:16:12+00:00 ["string" `template` ["sub_set"]] []'
        const expected = {section: [{line: [
            {operator: 'U'},
            {number: '1'},
            {number: '-2'},
            {number: '3.0'},
            {bool: 'true'},
            {null: 'null'},
            {decimal: '$4.63'},
            {decimal: '$-5'},
            {datetime: '~2018-08-02T09:16:12+00:00'},
            {set: [
                {string: '"string"'},
                {template: '`template`'},
                {set: [
                    {string: '"sub_set"'},
                ]},
            ]},
            {set: []},
        ]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse sections', ()=>{
        const in_ = `let a:
    let b:
        5

    c:
    U d:
        e:

def Foo relation: bar
    i:

let e:
    f:

g:
G :foo
    :bar count :bar_id
`
        const expected = [
            {"let": [{"relation": "a:"}, {"section": [
                {"let": [{"relation": "b:"}, {"section": [
                    {"line": [{"number": "5"}]}]}]
                },
                {"line": [{"relation": "c:"}]},
                {"line": [{"operator": "U"}, {"relation": "d:"}]}, {"section": [
                    {"line": [{"relation": "e:"}]}]}]}]
            },
            {"def": [{"operator": "Foo"}, {"relation": "relation:"}, {"var": "bar"}, {"section": [
                {"line": [{"relation": "i:"}]}]}]
            },
            {"let": [{"relation": "e:"}, {"section": [
                {"line": [{"relation": "f:"}]}]}]
            },
            {"line": [{"relation": "g:"}]},
            {"line": [{"operator": "G"}, {"header": ":foo"}]},
            {"section": [
                {"aggregator": [{"header": ":bar"}, {"var": "count"}, {"header": ":bar_id"}]}]}]
        assert.deepEqual(expected, parser.parser(in_).section)
    })
    it('should parse a relation literal', ()=>{
        const in_ = `| :a    |:b|
-------------------
| "foo"   | 2.4 |
|null  | -3  |
`
        const expected = {section: [
            {relation_literal: [
                {headers: [{header: ':a'}, {header: ':b'}]},
                {row: [{string: '"foo"'}, {number: '2.4'}]},
                {row: [{null: 'null'}, {number: '-3'}]},]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse an empty relation literal with no rows', ()=>{
        const in_ = `| |`
        const expected = {section: [
            {relation_literal: [
                {headers: []}]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse an empty relation literal with one row', ()=>{
        const in_ = `| |
---
| |`
        const expected = {section: [
            {relation_literal: [
                {headers: []},
                {row: []}]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should allow relation literals in other contexts', ()=>{
        const in_ = `let foo
    | :left |
    ---------
    | true  |
    J
        | :right |
        ----------
        | false  |

foo`
        const expected = {section: [
            {let: [{var: 'foo'}, {section: [
                {relation_literal: [
                    {headers: [{header: ':left'}]},
                    {row: [{bool: 'true'}]}]},
                {line: [{operator: 'J'}]}, {section: [
                    {relation_literal: [
                        {headers: [{header: ':right'}]},
                        {row: [{bool: 'false'}]}]}]}]},
            ]},
            {line: [{var: 'foo'}]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
})
