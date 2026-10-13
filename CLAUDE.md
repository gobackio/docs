# Writing the docs

Say things the way a person would. Prose is welcome; stilted phrasing is not.

- **Lead with the plain fact.** "goback can also be used as a library." Not "The goback CLI is built on its own packages, and a program can use them directly."
- **Say what goback does, not what it resembles.** "base connects with the usual Postgres connection settings", not "base connects as libpq does": readers take a comparison as a promise of compatibility.
- **Plain word order.** Subject, verb, object. No inversions ("Everything the CLI does, a Go program can do"), no clauses chained with ", and", no "takes what … do", "the one … that", "as … does".
- **What the reader can do, not how goback is built.** Internals belong in the Internals section only.
- **No lead-ins that restate the heading.**
- **Tables and code** where readers scan lists of fields, options or commands; sentences everywhere else.
- **Describe, don't sell.** No pitch, no adjectives doing the work, no folksy lines.
- **Claim only what a reader can check.** No absolutes ("never", "guarantees"); name the mechanism instead ("encrypted before upload").
- **No commitments that aren't made**: regions, prices, plans, tuning numbers.

Read each sentence aloud. If nobody would say it that way, rewrite it.
