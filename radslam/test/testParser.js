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
        const in_ = `some_var
`
        const expected = {section: [{line: [{var: 'some_var'}]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse a relation with a few operations', ()=>{
        const in_ = `
some_rel:
J other_rel:
| some_var other_var
Custom all:*`
        const expected = {section: [
            {line: [{relation: 'some_rel:'}]},
            {line: [{operator: 'J'}, {relation: 'other_rel:'}]},
            {line: [{operator: '|'}, {var: 'some_var'}, {var: 'other_var'}]},
            {line: [{operator: 'Custom'}, {all_headers: 'all:*'}]},
        ]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse JSON literals | [templates set]', ()=>{
        const in_ = '| 1 -2 3.0 true null ["string" `template` ["sub_set"]] []\n'
        const expected = {section: [{line: [
            {operator: '|'},
            {number: '1'},
            {number: '-2'},
            {number: '3.0'},
            {bool: 'true'},
            {null: 'null'},
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
    it('should parse blocks', ()=>{
        const in_ = `
let a:
    let b:
        5

    c:
    | d:
        e:

def Foo relation: bar
    i:

let e:
    f:

g:
G :foo
    :bar count :bar_id
`
        const expected = {"section": [
            {"let": [{"relation": "a:"}, {"section": [
                {"let": [{"relation": "b:"},{"section": [
                    {"line": [{"number": "5"}]}]}]
                },
                {"line": [{"relation": "c:"}]},
                {"line": [{"operator": "|"}, {"relation": "d:"}]}, {"section": [
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
                {"line": [{"header": ":bar"}, {"var": "count"}, {"header": ":bar_id"}]}]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
})
