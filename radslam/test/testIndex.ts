import { describe, it } from 'mocha'
import * as browserMock from 'mithril/test-utils/browserMock'

const window = browserMock()
window.document.getElementsByTagName = ()=>[]
window.document.querySelectorAll = ()=>[]
window.addEventListener = ()=>null

declare let global
global.underTest = true
global.window = window
global.document = window.document
global.requestAnimationFrame = ()=>1

import {test} from "../src/index";

describe('index', ()=>{
    it('should compile', ()=>{test})
})
