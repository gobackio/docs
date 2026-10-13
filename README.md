# goback docs

This is the source of docs.goback.io. It is built with [Starlight](https://starlight.astro.build).

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/, with the Pagefind search index
```

## CLI reference

`src/content/docs/reference/cli/` is generated from the CLI of a goback release. Don't edit it by hand.

```sh
goback docs > cli.json
npm run cli-reference -- cli.json
```

## License

The docs are licensed under the Apache License 2.0. See [LICENSE](LICENSE).
