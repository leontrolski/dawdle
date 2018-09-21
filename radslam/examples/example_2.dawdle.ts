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

const myFirstDef =
// {"dawdle": "begin", "indentLevel":0}
{"section":[{"relation_literal":[{"rl_headers":[]}]}]}
// {"dawdle": "end"}

const otherLet =
// {"dawdle": "begin", "indentLevel":0}
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
const foo = 'bar'
