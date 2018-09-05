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
J other_rel: :namespace.some_header
U some_var named=1.0
Custom other_other_rel:*
(map foo) \`yo\``
        const expected = {section: [
            {line: [{relation: 'some_rel:'}]},
            {line: [{operator: 'J'}, {relation: 'other_rel:'}, {header: ':namespace.some_header'}]},
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
    it('should parse a section', ()=>{
        const in_ = `a:
    42
`
        const expected = {section: [
            {line: [
                {relation: "a:"},
                {section: [
                    {line: [{number: "42"}]}]}]},
        ]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse 2 sections', ()=>{
        const in_ = `a:
    J
        7
`
        const expected = {section: [
            {line: [
                {relation: "a:"},
                {section: [
                    {line: [
                        {operator: "J"},
                        {section: [
                            {line: [{number: "7"}]}]}]}]}]},
        ]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse loads of sections', ()=>{
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
        const expected = {"section": [
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
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse a relation literal', ()=>{
        const in_ = `| :a    |:b|
-------------------
| "foo"   | 2.4 |
|null  | -3  |
`
        const expected = {section: [
            {relation_literal: [
                {rl_headers: [{header: ':a'}, {header: ':b'}]},
                {rl_row: [{string: '"foo"'}, {number: '2.4'}]},
                {rl_row: [{null: 'null'}, {number: '-3'}]},]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse an empty relation literal with no rows', ()=>{
        const in_ = `| |`
        const expected = {section: [
            {relation_literal: [
                {rl_headers: []}]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse an empty relation literal with one row', ()=>{
        const in_ = `| |
---
| |`
        const expected = {section: [
            {relation_literal: [
                {rl_headers: []},
                {rl_row: []}]}]}
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
                    {rl_headers: [{header: ':left'}]},
                    {rl_row: [{bool: 'true'}]}]},
                {line: [{operator: 'J'}, {section: [
                    {relation_literal: [
                        {rl_headers: [{header: ':right'}]},
                        {rl_row: [{bool: 'false'}]}]}]}]}]},
            ]},
            {line: [{var: 'foo'}]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
    it('should parse multirelation syntax', ()=>{
        const in_ = `let oliver:
    user:
    > equals :name "oliver"
    > one

def AllUserJoins relation:
    relation:
    -[multirelation]-
        -[basket basket_discount:
            ]-join basket__discount:
                -[discount discount:
            -[purchase purchase:
                -[product product:

oliver:
AllUserJoins
`
        const expected = {section:
            [
                {let: [{relation:'oliver:'}, {section: [
                    {line: [{relation: 'user:' }]},
                    {line: [{ operator: '>'}, {var: 'equals'}, {header: ':name'}, {string: '"oliver"'}]},
                    {line: [{ operator: '>'}, {var: 'one'}]}]}]},
                {def: [{operator: 'AllUserJoins' }, {relation: 'relation:'}, {section: [
                    {line: [{ relation: 'relation:'}]},
                    {line: [{operator: '-[multirelation]-'}, {section: [
                        {line: [{to_many: "-[basket"}, {relation: 'basket_discount:'}, {section: [
                            {line: [{to_one: "]-join"}, {relation: 'basket__discount:'}, {section: [
                                {line: [{to_many: "-[discount"}, {relation: "discount:"}]}]}]},
                            {line: [{to_many: "-[purchase"}, {relation: 'purchase:'}, { section: [
                                {line: [{to_many: "-[product"}, {relation: "product:"}]}]}]}]}]}]}]}]}]},
              {line: [{relation: 'oliver:' }]},
              {line: [{operator: 'AllUserJoins'}]}]}
        assert.deepEqual(expected, parser.parser(in_))
    })
})




xdescribe('parser.fullParser', ()=>{
    it('should parse two vars in a set with their positions', ()=>{
        const in_ = "[foo bar]"
        //           012345678
        const expected = {
            start: 0,
            end: 9,
            errors: [],
            section: [
                {
                    start: 0,
                    end: 9,
                    errors: [],
                    line: [
                        {
                            start: 0,
                            end: 9,
                            errors: [],
                            set: [
                                {
                                    start: 1,
                                    end: 4,
                                    errors: [],
                                    var: 'foo'
                                }, {
                                    start: 5,
                                    end: 8,
                                    errors: [],
                                    var: 'bar'
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        assert.deepEqual(expected, parser.fullParser(in_))
    })
    it('should give a (semi) useful error when unable to parse', ()=>{
        // this is a pretty rubbish test
        // but also maybe the errors raised are a bit rubbish too..?
        // maybe the parser top level shouldn't be 'section' or seomthing like that...?
        const in_ = "[foo bar]\n["
        //           0123456789 0
        const expected = "Unexpected end of input: \n["
        assert.deepEqual(expected, parser.fullParser(in_).errors[0].message)
    })
    it('should give a useful error when unable to parse a particular line')
    it('should (maybe) correct for one indent', ()=>{
        const in_ = "a:\nU\n    b:\n"
        //           012 34 5678901
        const expected = {
            start: 0,
            end: 12,
            errors: [],
            section: [
                {
                    start: 0,
                    end: 3,
                    errors: [],
                    line: [
                        {
                            start: 0,
                            end: 2,
                            errors: [],
                            relation: 'a:',
                        }
                    ],
                }, {
                    start: 3,
                    end: 5,
                    errors: [],
                    line: [
                        {
                            start: 3,
                            end: 4,
                            errors: [],
                            operator: 'U',
                        }
                    ],
                }, {
                    start: 5,
                    end: 12,
                    errors: [],
                    section: [
                        {
                            start: 5,
                            end: 12,
                            errors: [],
                            line: [
                                {
                                    start: 9,
                                    end: 11,
                                    errors: [],
                                    relation: 'b:',
                                }
                            ],
                        }
                    ],
                }
            ]
        }
        assert.deepEqual(expected, parser.fullParser(in_))
    })
    it('should (maybe) correct for multiple indents')
})