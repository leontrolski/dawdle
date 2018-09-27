import { describe, it } from 'mocha'
import { assert } from 'chai'
import * as browserMock from 'mithril/test-utils/browserMock'

const window = (<any>browserMock)() as any
window.document.getElementsByTagName = function(): any[] {return []}
window.document.querySelectorAll = function(): any[] {return []}
window.addEventListener = function(): void {return null}

declare let global: any
global.underTest = true
global.window = window
global.document = window.document
global.requestAnimationFrame = ()=>1

import * as index from "../src/index";
import { range } from 'ramda';

describe('index', ()=>{
    it('should compile', ()=>{index.test})
    it('should raise an error when it fails to parse a complete relation literal', ()=>{
        const old = `foo-0
    foo-1
    bar-2
qux-3`
        const new_ = `foo-0
    foo-1
    n-bar-2
another-3

qux-3`
        const lineDiff = index.mapOldLineToNew(old, new_)
        assert.deepEqual(lineDiff, {
            0: 0,
            1: 1,
            3: 5,
        })
    })
})
