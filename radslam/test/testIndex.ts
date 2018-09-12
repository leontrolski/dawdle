
import * as browserMock from 'mithril/test-utils/browserMock'

const window = browserMock()
window.document.getElementsByTagName = ()=>[]
window.document.querySelectorAll = ()=>[]

declare let global
global.window = window
global.document = window.document
global.requestAnimationFrame = ()=>1

import {test} from "../src/index";

describe('index', ()=>{
    it('should compile', ()=>{test})
})
