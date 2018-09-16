# {"dawdle": "header", "originalLanguage": "python", "command": "venv/python $FILE --dawdle"}
# FILE=example_1.py eval 'venv/bin/python $FILE --dawdle'
import foo

d = [1, 2, 3]

while len(d) > 100:
    pass

01234567890123456789012345678901234567890123456789012345678901234567890123456789
1         2         3         4         5         6         7         8

ast = (
# {"dawdle": "begin", "indentLevel": 0}
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
# {"dawdle": "end"}
)
