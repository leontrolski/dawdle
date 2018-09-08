const chai = require('chai')

const parser = require('../src/parser')
const astToString = require('../src/astToString')

const assert = chai.assert
chai.config.includeStack = true
chai.config.truncateThreshold = 1000


describe('astToString.astToString', ()=>{
    it('should stringify literals U [templates set]', ()=>{
        const in_ = {section: [{line: [
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
        const expected = 'U 1 -2 3.0 true null $4.63 $-5 ~2018-08-02T09:16:12+00:00 ["string" `template` ["sub_set"]] []'
        assert.deepEqual(expected, astToString.astToString(in_))
    })
    it('should stringify a single section', ()=>{
        const in_ = {section: [
            {line: [{relation: 'some_rel:'}]},
            {line: [{operator: 'J'}, {relation: 'other_rel:'}, {header: ':namespace.some_header'}]},
            {line: [{operator: 'U'}, {var: 'some_var'}, {named_value: [{var: 'named'}, {number: '1.0'}]}]},
            {line: [{operator: 'Custom'}, {all_headers: 'other_other_rel:*'}]},
            {map_macro: [{var: 'foo'}, {template: "`yo`"}]},
        ]}
        const expected = `some_rel:
J other_rel: :namespace.some_header
U some_var named=1.0
Custom other_other_rel:*
(map foo) \`yo\``
        assert.deepEqual(expected, astToString.astToString(in_))
    })
    it('should stringify nested sections', ()=>{
        const in_ = {section:
            [{line: [{number: "1"}, {section:
                [{line: [{number: "2"}, {section:
                    [{line: [{number: "3"}, {section:
                            [{line: [{number: "4"}, {section:
                                [{line: [{number: "5"}]}]}]}]}]}]}]}]}]}]}
        const expected = `1
    2
        3
            4
                5`
        assert.deepEqual(expected, astToString.astToString(in_))
    })
    it('should stringify multiple nested sections', ()=>{
        const in_ = {"section": [
            {"let": [{"relation": "a:"}, {"section": [
                {"let": [{"relation": "b:"}, {"section": [
                    {"line": [{"number": "5"}]}]}]
                },
                {"line": [{"relation": "c:"}]},
                {"line": [{"operator": "U"}, {"relation": "d:"}, {"section": [
                    {"line": [{"relation": "e:"}]}]}]}]}]
            },
            {"def": [{"operator": "Foo"}, {"relation": "relation:"}, {"var": "bar"}, {"section": [
                {"line": [{"relation": "i:"}]}]}]
            },
            {"let": [{"relation": "e:"}, {"section": [
                {"line": [{"relation": "f:"}]}]}]
            },
            {"line": [{"relation": "g:"}]},
            {"line": [{"operator": "G"}, {"header": ":foo"}, {"section": [
                {"aggregator": [{"header": ":bar"}, {"var": "count"}, {"header": ":bar_id"}]}]}]},
            {"line": [{"operator": "-[multirelation]-"}, {"section": [
                {"line": [{"to_many": "-[h"}, {"relation": "h:"}]}]}]},
        ]}
        const expected = `let a:
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
-[multirelation]-
    -[h h:`
        assert.deepEqual(expected, astToString.astToString(in_))
    })
    it('should stringify a relation literal', ()=>{
        const in_ = {section: [
            {relation_literal: [
                {rl_headers: [{header: ':a'}, {header: ':b'}]},
                {rl_row: [{string: '"foo"'}, {number: '2.4'}]},
                {rl_row: [{null: 'null'}, {number: '-3'}]},]}]}
        const expected = `| :a    | :b  |
---------------
| "foo" | 2.4 |
| null  | -3  |`
        assert.deepEqual(expected, astToString.astToString(in_))
    })
    it('should stringify an empty relation literal with no rows', ()=>{
        const in_ = {section: [
            {relation_literal: [
                {rl_headers: []}]}]}
        const expected = `| |`
        assert.deepEqual(expected, astToString.astToString(in_))
    })
    it('should stringify an empty relation literal with one row', ()=>{
        const in_ = {section: [
            {relation_literal: [
                {rl_headers: []},
                {rl_row: []}]}]}
        const expected = `| |
---
| |`
        assert.deepEqual(expected, astToString.astToString(in_))
    })
})
describe('astToString.jsonifyAndIndent', ()=>{
    it('should return an indented JSON AST', ()=>{
        const in_ = {"section": [
            {"let": [{"relation": "a:"}, {"section": [
                {"let": [{"relation": "b:"}, {"section": [
                    {"line": [{"number": "5"}]}]}]
                },
                {"line": [{"relation": "c:"}]},
                {"line": [{"operator": "U"}, {"relation": "d:"}, {"section": [
                    {"line": [{"relation": "e:"}]}]}]}]}]
            },
            {"def": [{"operator": "Foo"}, {"relation": "relation:"}, {"var": "bar"}, {"section": [
                {"line": [{"relation": "i:"}]}]}]
            },
            {"let": [{"relation": "e:"}, {"section": [
                {"line": [{"relation": "f:"}]}]}]
            },
            {"line": [{"relation": "g:"}]},
            {"line": [{"operator": "G"}, {"header": ":foo"}, {"section": [
                {"aggregator": [{"header": ":bar"}, {"var": "count"}, {"header": ":bar_id"}]}]}]}]}
        const expected = `{"section":[[{"let":[{"relation":"a:"},
{"section":[[{"let":[{"relation":"b:"},
{"section":[[
    {"line":[{"number":"5"}]}]}]},
    {"line":[{"relation":"c:"}]},
    {"line":[{"operator":"U"},{"relation":"d:"},
{"section":[[
    {"line":[{"relation":"e:"}]}]}]}]}]},{"def":[{"operator":"Foo"},{"relation":"relation:"},{"var":"bar"},
{"section":[[
    {"line":[{"relation":"i:"}]}]}]},{"let":[{"relation":"e:"},
{"section":[[
    {"line":[{"relation":"f:"}]}]}]},
    {"line":[{"relation":"g:"}]},
    {"line":[{"operator":"G"},{"header":":foo"},
{"section":[[{"aggregator":[{"header":":bar"},{"var":"count"},{"header":":bar_id"}]}]}]}]}`
        assert.deepEqual(expected, astToString.jsonifyAndIndent(in_))
    })
})