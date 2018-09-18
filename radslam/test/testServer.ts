import { describe, it } from 'mocha'

declare let global: any
global.underTest = true

import { test } from "../src/server";

describe('server', ()=>{
    it('should compile', ()=>{test})
})
