// {"dawdle": "header", "originalLanguage": "typescript"}
import { assert } from 'chai'

import * as stdlib from '../../src/stdlib'
import * as compiler from '../../src/compiler'

const customEnv = compiler.letsToEnv(stdlib.env,
// {"dawdle": "begin"}
{"section":[{"let":[{"relation":"basket:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":basket_id"}]},
    {"rl_row":[{"number":"1"}]}]}]}]},
    {"line":[{"set":[]}]}]}
// {"dawdle": "end"}
)
export const defaultEnv = stdlib.env.merge(customEnv)
