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

a-0`
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
</SECTION>
`
        assert.deepEqual(parser.addIndents(in_), expected)
    })
})

describe('parser.parser', ()=>{
    it('should parse a single var', ()=>{
        const in_ = `some_var`
        const expected = {
            t: 'program',
            c: [{
                t: 'block',
                c: [{
                    t: 'line',
                    c: [{t: 'var', v: 'some_var'}]
                }]
            }],
        }
        assert.deepEqual(parser.useful(parser.parser(in_)), expected)
    })
    it('should parse a relation with a couple of operations', ()=>{
        const in_ = `some_rel:
J other_rel:
| some_var other_var`
        const expected = [{
            t: 'block',
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
                        {t: 'value', c: {t: 'relation', v: 'other_rel:'}},
                    ]
                },
                {
                    t: 'line',
                    c: [
                        {t: 'operator', v: '|'},
                        {t: 'value', c: {t: 'var', v: 'some_var'}},
                        {t: 'value', c: {t: 'var', v: 'other_var'}},
                    ]
                },
            ]
        }]
        assert.deepEqual(parser.useful(parser.parser(in_)).c, expected)
    })
})