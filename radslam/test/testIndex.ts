import { describe, it } from 'mocha'
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

import {test} from "../src/index";

describe('index', ()=>{
    it('should compile', ()=>{test})
})
