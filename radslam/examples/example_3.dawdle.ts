// {"dawdle": "header", "originalLanguage": "typescript", "command": "venv/python $FILE --dawdle"}
import { FunctionAPI, DawdleModuleAPI } from '../src/shared'
import { types, Header, Value } from '../src/parser';

// here we go!
const setExample =
// {"dawdle": "begin", "indentLevel":0}
{"section":[
    {"line":[{"set":[{"number":"1"},{"number":"2"},{"string":"\"foo\""}]}]},
    {"line":[{"operator":"U"},{"set":[{"number":"2"},{"string":"\"foo\""},{"number":"4"},{"number":"5"}]}]},
    {"line":[{"operator":"-"},{"set":[{"number":"2"},{"number":"4"}]}]}]}
// {"dawdle": "end"}
const myFirstTable =
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"let":[{"relation":"user:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":user_id"},{"header":":username"},{"header":":dob"}]},
    {"rl_row":[{"number":"1"},{"string":"\"Oliver\""},{"datetime":"~1985-01-20"}]},
    {"rl_row":[{"number":"2"},{"string":"\"Tom\""},{"datetime":"~1950-02-20"}]},
    {"rl_row":[{"number":"3"},{"string":"\"Jackie\""},{"null":"null"}]}]}]}]},{"let":[{"relation":"example-line-break:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":user_id"},{"header":":town_maybe_city_maybe_some_other_long_thing"}]},
    {"rl_row":[{"number":"1"},{"string":"\"Slough\""}]},
    {"rl_row":[{"number":"2"},{"string":"\"Chicago\""}]},
    {"rl_row":[{"number":"3"},{"string":"\"The North\""}]}]}]}]},
    {"line":[{"relation":"user:"}]},
    {"line":[{"operator":"J"},{"relation":"example-line-break:"}]}]}
// {"dawdle": "end"}
const lt: FunctionAPI = {
    type: 'filter',
    name: 'lt',
    args: [
        {name: 'a', types: [types.header]},
        {name: 'b', types: [types.number]},
    ],
    func: (rel, a: Header, b: Value)=>{
        const i = rel.headers.indexOf(a.value.slice(1))
        return {headers: rel.headers, rows: rel.rows.filter(row=>row[i] < b.value)}
    }
}
const moduleAPI: DawdleModuleAPI = {
    defaultEnv: {
        lt: {
            type: 'let',
            value: [
                {type: 'var', value: 'lt'},
                lt
            ]
        },
    }
}

export const defaultEnv = moduleAPI.defaultEnv

const myFirstOperations =
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":a"},{"header":":b"},{"header":":c"}]},
    {"rl_row":[{"number":"1"},{"number":"14"},{"number":"435"}]},
    {"rl_row":[{"number":"6"},{"number":"10"},{"number":"756"}]},
    {"rl_row":[{"number":"2"},{"number":"45"},{"number":"285"}]}]},
    {"line":[{"operator":">"},{"var":"lt"},{"header":":a"},{"number":"5"}]},
    {"line":[{"operator":"J"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":d"},{"header":":a"}]},
    {"rl_row":[{"number":"7"},{"number":"1"}]},
    {"rl_row":[{"number":"8"},{"number":"2"}]},
    {"rl_row":[{"number":"4"},{"number":"2"}]},
    {"rl_row":[{"number":"9"},{"number":"6"}]},
    {"rl_row":[{"number":"0"},{"number":"4"}]}]}]}]},
    {"line":[{"operator":"v"},{"header":":d"},{"header":":c"}]}]}
// {"dawdle": "end"}
const foo = 'bar'