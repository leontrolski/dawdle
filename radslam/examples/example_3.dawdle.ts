// {"dawdle": "header", "originalLanguage": "typescript", "command": "venv/python $FILE --dawdle"}
import { assert } from 'chai'

import * as stdlib from '../src/stdlib'
import * as compiler from '../src/compiler'

const customEnv = compiler.letsToEnv(stdlib.env,
// {"dawdle": "begin"}
{"section":[{"let":[{"relation":"user:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":user_id"},{"header":":username"},{"header":":dob"}]},
    {"rl_row":[{"number":"1"},{"string":"\"Oliver\""},{"datetime":"~1985-01-20"}]},
    {"rl_row":[{"number":"2"},{"string":"\"Tom\""},{"datetime":"~1950-02-20"}]},
    {"rl_row":[{"number":"3"},{"string":"\"Jackie\""},{"null":"null"}]}]}]}]},{"let":[{"relation":"user_towns:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":user_id"},{"header":":town"}]},
    {"rl_row":[{"number":"1"},{"string":"\"Slough\""}]},
    {"rl_row":[{"number":"2"},{"string":"\"Chicago\""}]},
    {"rl_row":[{"number":"3"},{"string":"\"The North\""}]}]}]}]},
    {"line":[{"set":[]}]}]}
// {"dawdle": "end"}
)
// see DawdleModuleAPI
export const defaultEnv: compiler.Env = stdlib.env.merge(customEnv)

const setExample =
// {"dawdle": "begin", "indentLevel":0}
{"section":[
    {"line":[{"set":[{"number":"1"},{"number":"2"},{"string":"\"foo\""}]}]},
    {"line":[{"operator":"U"},{"set":[{"number":"2"},{"string":"\"foo\""},{"number":"4"},{"number":"56"}]}]},
    {"line":[{"operator":"-"},{"set":[{"number":"2"},{"number":"4"}]}]}]}
// {"dawdle": "end"}
const myFirstTable =
// {"dawdle": "begin", "indentLevel":0}
{"section":[
    {"line":[{"relation":"user:"}]},
    {"line":[{"operator":"J"},{"relation":"user_towns:"}]},
    {"line":[{"operator":">"},{"var":"like"},{"header":":town"},{"string":"\"%g%\""}]}]}
// {"dawdle": "end"}
const actual = compiler.compileAST(defaultEnv,
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":a"},{"header":":b"},{"header":":c"}]},
    {"rl_row":[{"number":"1"},{"number":"14"},{"number":"435"}]},
    {"rl_row":[{"number":"6"},{"number":"10"},{"number":"756"}]},
    {"rl_row":[{"number":"2"},{"number":"42"},{"number":"285"}]}]},
    {"line":[{"operator":">"},{"var":"lt"},{"header":":a"},{"number":"5"}]},
    {"line":[{"operator":"J"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":d"},{"header":":a"}]},
    {"rl_row":[{"number":"7"},{"number":"1"}]},
    {"rl_row":[{"number":"8"},{"number":"2"}]},
    {"rl_row":[{"number":"4"},{"number":"2"}]},
    {"rl_row":[{"number":"9"},{"number":"6"}]},
    {"rl_row":[{"number":"0"},{"number":"4"}]}]}]}]},
    {"line":[{"operator":"v"},{"header":":d"},{"header":":c"}]},
    {"line":[{"operator":">"},{"var":"eq"},{"header":":d"},{"number":"7"}]},
    {"line":[{"operator":"U"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":d"},{"header":":c"}]},
    {"rl_row":[{"number":"7"},{"number":"480"}]}]}]}]}]}
// {"dawdle": "end"}
)

const expected = compiler.compileAST(defaultEnv,
// {"dawdle": "begin"}
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":d"},{"header":":c"}]},
    {"rl_row":[{"number":"7"},{"number":"435"}]}]}]}
// {"dawdle": "end"}
)

assert.deepEqual(actual, expected)
