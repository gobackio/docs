# goback docs

Source of docs.goback.io, built with [Starlight](https://starlight.astro.build).

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/, with the Pagefind search index
```

## CLI reference

`src/content/docs/reference/cli/` is generated from the CLI of a goback release; don't edit it by hand.

```sh
goback docs > cli.json
npm run cli-reference -- cli.json
```
