# Dawdle

Dawdle is a relational DSL that I played around making in 2018, the aim was to explore some stuff surrounding relational theory and building an interpereter - _hence a lot of the code is questionable quality_. Hopefully, you can get things running with:

```bash
cd radslam
npm run bundle -- --mode development  # --watch
npm run ts -- src/server.ts
google-chrome http://localhost:3000/?path=examples/example_3.dawdle.ts
```

A screenshot from the editor:

![example-3](screenshots/example_3.dawdle.png)

Some random notes copy-pasta-ed from the code:

- `header`s are in the form `:some_header`
- the types supported are the JSON types, plus:
  - datetime in the form `~some-ISO-8601`
  - decimals in the form `$1.05`
- the columns themselves are not typed, it is up to the host language
  to enforce.

Now some relational operations, we have:
`>` filter
`v` select
`^` extend
`X` cross
`U` union
`-` difference
`J` join
`G` group

`> v ^` are pictographic

Also, notice the indented relation literal after the join. Indented sections
are appended to the args of the operation above them.
