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
