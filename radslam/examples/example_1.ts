// {"dawdle": "header", "originalLanguage": "typescript", "command": "venv/python $FILE --dawdle"}
import * as foo from 'foo'

const d = [1, 2, 3]

while(d.length > 100){
    console.log('whut')
}

const possibleEnvs = [
// {"dawdle": "begin", "indentLevel": 0}
{"section":[
    {"let":[{"var":"foo"},{"section":[{"line":[{"set": [{"string":"\"it should be possible for this to be a number\""}]}]}]}]},
    {"relation_literal":[{"rl_headers":[{"header":":this-line-shouldnt-need-to-be-here"}]}]}
]}
// {"dawdle": "end"}
]

const ast = (
// {"dawdle": "begin", "indentLevel": 0}
{"section":[{"def":[{"operator":"JoinClone"},{"relation":"relation:"},{"relation":"right:"},
{"section":[
    {"line":[{"relation":"relation:"}]},
    {"line":[{"operator":"J"},{"relation":"right:"}]}]}]},{"let":[{"relation":"bar:"},
{"section":[{"def":[{"operator":"Identity"},{"relation":"relation:"},
{"section":[
    {"line":[{"relation":"relation:"}]}]}]},{"relation_literal":[{"rl_headers":[{"header":":a"},{"header":":b"}]},{"rl_row":[{"number":"6"},{"number":"8"}]}]},
    {"line":[{"operator":"Identity"}]}]}]},{"relation_literal":[{"rl_headers":[{"header":":a"},{"header":":b"}]},{"rl_row":[{"number":"1"},{"number":"5"}]}]},
    {"line":[{"operator":"U"},{"relation":"bar:"}]},
    {"line":[{"operator":"JoinClone"},
{"section":[{"relation_literal":[{"rl_headers":[{"header":":a"},{"header":":c"}]}]}]}]}]}
// {"dawdle": "end"}
)
