// {"dawdle": "header", "originalLanguage": "typescript", "command": "venv/python $FILE --dawdle"}
// `dawdle` is a DSL for working with relational data inside of an existing
// language.

// This file is written in `TypeScript`, but the blocks below with grey bars on the
// top and the bottom are in `dawdle`. They are stored in the file as an AST so
// they can be easily used by the host language, but in the browser based editor
// we can see them as `dawdle`. An AST has a canonical representation in `dawdle`.

// A host language can do as it wishes with the supplied AST, on the front end
// this may be working with plain-ol'-objects, on the back end, it may be
// generating SQL or DataFrame code. `dawdle` has a well defined interface such
// that the resulting data can be passed back to the editor for inspection.

// let's start with some basic `set` operations, we have:

// `U` set union
// `-` set difference

const setExample =
// {"dawdle": "begin", "indentLevel":0}
{"section":[
    {"line":[{"set":[{"number":"1"},{"number":"2"},{"string":"\"foo\""}]}]},
    {"line":[{"operator":"U"},{"set":[{"number":"2"},{"string":"\"foo\""},{"number":"4"},{"number":"5"}]}]},
    {"line":[{"operator":"-"},{"set":[{"number":"2"},{"number":"4"}]}]}]}
// {"dawdle": "end"}
// `relations` are like tables in SQL, except that they are unordered sets of
// rows and they don't have to be persisted in any way.

// `dawdle` has special syntax for table literals:

const myFirstTable =
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"relation_literal":[{"rl_headers":[{"header":":user_id"},{"header":":username"},{"header":":dob"}]},{"rl_row":[{"number":"1"},{"string":"\"Oliver\""},{"datetime":"~1985-01-20"}]},{"rl_row":[{"number":"2"},{"string":"\"Tom\""},{"datetime":"~1950-02-20"}]},{"rl_row":[{"number":"3"},{"string":"\"Jack\""},{"null":"null"}]}]}]}
// {"dawdle": "end"}
// Note a few things:
//
// - `header`s are in the form `:some_header`
// - the types supported are the JSON types, plus:
//   - datetime in the form `~some-ISO-8601`
//   - decimals in the form `$1.05`
// - the columns themselves are not typed, it is up to the host language
//   to enforce.

// Now let's do some relational operations, we have:

// `>` filter
// `v` select
// `^` extend
// `X` cross
// `U` union
// `-` difference
// `J` join
// `G` group

// `> v ^` are pictographic

//////////
// TODO: add a standard library of functions
//////////

const myFirstOperations =
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"let":[{"var":"lt"},
{"section":[{"relation_literal":[{"rl_headers":[]}]}]}]},{"relation_literal":[{"rl_headers":[{"header":":a"},{"header":":b"},{"header":":c"}]},{"rl_row":[{"number":"1"},{"number":"14"},{"number":"435"}]},{"rl_row":[{"number":"6"},{"number":"10"},{"number":"756"}]},{"rl_row":[{"number":"2"},{"number":"45"},{"number":"285"}]}]},
    {"line":[{"operator":">"},{"var":"lt"},{"header":":a"},{"number":"5"}]},
    {"line":[{"operator":"J"},
{"section":[{"relation_literal":[{"rl_headers":[{"header":":d"},{"header":":a"}]},{"rl_row":[{"number":"7"},{"number":"1"}]},{"rl_row":[{"number":"8"},{"number":"2"}]},{"rl_row":[{"number":"9"},{"number":"6"}]},{"rl_row":[{"number":"0"},{"number":"4"}]}]}]}]},
    {"line":[{"operator":"v"},{"header":":d"},{"header":":c"}]}]}
// {"dawdle": "end"}
// Note the form of the filter: `> function ...args`

// Also, notice the indented relation literal after the join. Indented sections
// are appended to the args of the operation above them.

// The above could be equivalently written with the `let` keyword as:

const myFirstLet =
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"let":[{"var":"lt"},
{"section":[{"relation_literal":[{"rl_headers":[]}]}]}]},{"let":[{"relation":"relation_a:"},
{"section":[{"relation_literal":[{"rl_headers":[{"header":":a"},{"header":":b"},{"header":":c"}]},{"rl_row":[{"number":"1"},{"number":"14"},{"number":"435"}]},{"rl_row":[{"number":"6"},{"number":"10"},{"number":"756"}]},{"rl_row":[{"number":"2"},{"number":"45"},{"number":"285"}]}]}]}]},{"let":[{"relation":"relation_d:"},
{"section":[{"relation_literal":[{"rl_headers":[{"header":":d"},{"header":":a"}]},{"rl_row":[{"number":"7"},{"number":"1"}]},{"rl_row":[{"number":"8"},{"number":"2"}]},{"rl_row":[{"number":"9"},{"number":"6"}]},{"rl_row":[{"number":"0"},{"number":"4"}]}]}]}]},
    {"line":[{"relation":"relation_a:"}]},
    {"line":[{"operator":">"},{"var":"lt"},{"header":":a"},{"number":"5"}]},
    {"line":[{"operator":"J"},{"relation":"relation_d:"}]},
    {"line":[{"operator":"v"},{"header":":d"},{"header":":c"}]}]}
// {"dawdle": "end"}
// Composite operators allow parametrised grouping of the 8 operators listed
// above. Let's make a namespace composite operator:

// TODO: why can't we access the `namespace` var in the function, 
// or inline the new headers

const myFirstDef =
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"def":[{"operator":"Namespace"},{"relation":"relation:"},{"var":"namespace"},
{"section":[{"let":[{"relation":"duplicated:"},
{"section":[
    {"line":[{"relation":"relation:"}]},{"map_macro":[{"all_headers":"relation:*"},{"template":"`^ {{_}}__we-should-be-able-to-access-namespace`"}]}]}]},{"let":[{"var":"new_headers"},
{"section":[
    {"line":[{"all_headers":"duplicated:*"}]},
    {"line":[{"operator":"-"},{"all_headers":"relation:*"}]}]}]},
    {"line":[{"relation":"duplicated:"}]},
    {"line":[{"operator":"v"},{"var":"new_headers"}]}]}]},{"relation_literal":[{"rl_headers":[{"header":":a"},{"header":":b"}]}]},
    {"line":[{"operator":"Namespace"},{"string":"\"some_namespace\""}]}]}
// {"dawdle": "end"}
// Below we recreate the outer join often found in SQL using the `def`
// keyword and the base operators.

const deriveOuterJoin =
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"let":[{"var":"value"},
{"section":[{"relation_literal":[{"rl_headers":[]}]}]}]},{"let":[{"var":"first"},
{"section":[{"relation_literal":[{"rl_headers":[]}]}]}]},{"let":[{"var":"make_null"},
{"section":[{"relation_literal":[{"rl_headers":[]}]}]}]},{"def":[{"operator":"Outer"},{"relation":"relation:"},{"relation":"right:"},
{"section":[{"let":[{"var":"right_headers"},
{"section":[
    {"line":[{"all_headers":"right:*"}]},
    {"line":[{"operator":"-"},{"all_headers":"relation:*"}]}]}]},{"let":[{"relation":"joined:"},
{"section":[
    {"line":[{"relation":"relation:"}]},
    {"line":[{"operator":"J"},{"relation":"right:"}]}]}]},{"let":[{"relation":"right_nulls:"},
{"section":[
    {"line":[{"relation":"relation:"}]},
    {"line":[{"operator":"-"},
{"section":[
    {"line":[{"relation":"joined:"}]},
    {"line":[{"operator":"v"},{"all_headers":"relation:*"}]}]}]},
    {"line":[{"operator":"X"},
{"section":[
    {"line":[{"relation":"right:"}]},
    {"line":[{"operator":">"},{"var":"first"}]},
    {"line":[{"operator":"v"},{"var":"right_headers"}]},{"map_macro":[{"var":"right_headers"},{"template":"`^ {{_}} make_null`"}]}]}]}]}]},
    {"line":[{"relation":"right_nulls:"}]},
    {"line":[{"operator":"U"},{"relation":"joined:"}]}]}]},{"let":[{"relation":"left:"},
{"section":[{"relation_literal":[{"rl_headers":[{"header":":left_id"},{"header":":l"}]},{"rl_row":[{"number":"1"},{"number":"10"}]},{"rl_row":[{"number":"2"},{"number":"20"}]},{"rl_row":[{"number":"3"},{"number":"30"}]}]}]}]},{"let":[{"relation":"right:"},
{"section":[{"relation_literal":[{"rl_headers":[{"header":":right_id"},{"header":":left_id"},{"header":":r"}]},{"rl_row":[{"number":"1"},{"number":"1"},{"number":"11"}]},{"rl_row":[{"number":"2"},{"number":"1"},{"number":"12"}]},{"rl_row":[{"number":"3"},{"number":"2"},{"number":"23"}]}]}]}]},
    {"line":[{"relation":"left:"}]},
    {"line":[{"operator":"Outer"},{"relation":"right:"}]}]}
// {"dawdle": "end"}
// demo using sets as arguments and group by


const otherLet =
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"let":[{"relation":"relation_a:"},
{"section":[{"relation_literal":[{"rl_headers":[{"header":":a"},{"header":":b"},{"header":":c"},{"header":":d"},{"header":":e"}]},{"rl_row":[{"number":"1"},{"number":"14"},{"number":"45"},{"number":"1"},{"string":"\"foo\""}]},{"rl_row":[{"number":"2"},{"number":"10"},{"number":"76"},{"number":"2"},{"string":"\"bar\""}]},{"rl_row":[{"number":"3"},{"number":"10"},{"number":"2"},{"number":"5"},{"string":"\"bar\""}]},{"rl_row":[{"number":"4"},{"number":"10"},{"number":"2"},{"number":"5"},{"string":"\"qux\""}]},{"rl_row":[{"number":"5"},{"number":"45"},{"number":"35"},{"number":"6"},{"string":"\"qux\""}]}]}]}]},{"let":[{"relation":"grouped:"},
{"section":[
    {"line":[{"relation":"relation_a:"}]},
    {"line":[{"operator":"G"},{"header":":b"},{"header":":e"},
{"section":[{"aggregator":[{"header":":sum_c"},{"var":"sum"},{"header":":c"}]},{"aggregator":[{"header":":agg_e"},{"var":"array_agg"},{"header":":e"}]}]}]}]}]},{"let":[{"var":"keep"},
{"section":[
    {"line":[{"all_headers":"grouped:*"}]},
    {"line":[{"operator":"-"},{"set":[{"header":":e"}]}]}]}]},
    {"line":[{"relation":"grouped:"}]},
    {"line":[{"operator":"v"},{"var":"keep"}]}]}
// {"dawdle": "end"}
const foo = 'bar'
