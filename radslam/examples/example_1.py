# {"dawdle": "header", "language": "python", "command": "venv/python $FILE --dawdle"}
# FILE=example_1.py eval 'venv/bin/python $FILE --dawdle'
import foo

d = [1, 2, 3]

while len(d) > 100:
    pass

01234567890123456789012345678901234567890123456789012345678901234567890123456789
1         2         3         4         5         6         7         8

ast = (
# {"dawdle": "begin"}
{"section":[[{"let":[{"relation":"a:"},
{"section":[[{"let":[{"relation":"b:"},
{"section":[[
    {"line":[{"number":"5"}]}]}]},
    {"line":[{"relation":"c:"}]},
    {"line":[{"operator":"U"},{"relation":"d:"},
{"section":[[
    {"line":[{"relation":"e:"}]}]}]}]}]},{"def":[{"operator":"Foo"},{"relation":"relation:"},{"var":"bar"},
{"section":[[
    {"line":[{"relation":"i:"}]}]}]},{"let":[{"relation":"e:"},
{"section":[[
    {"line":[{"relation":"f:"}]}]}]},
    {"line":[{"relation":"g:"}]},
    {"line":[{"operator":"G"},{"header":":foo"},
{"section":[[{"aggregator":[{"header":":bar"},{"var":"count"},{"header":":bar_id"}]}]}]}]}
# {"dawdle": "end"}
)
x