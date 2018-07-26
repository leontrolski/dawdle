const chai = require('chai')

const parser = require('../parser')

const assert = chai.assert
chai.config.includeStack = true
chai.config.truncateThreshold = 1000

describe('parser.addIndents', ()=>{
    const in_ = `foo`
    const expected = `bar`
    it('should add sections and indents', ()=>assert.deepEqual(
        parser.addIndents(in_),
        expected
    ))
})