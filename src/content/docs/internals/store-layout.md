---
title: Store layout
description: Archives, their indexes, compaction and sealing at rest.
---

## Archives

Agents upload objects in archives. Each archive carries its own index of the objects it holds, so the store can be read without any database.

| Operation | Does | Runs |
| --- | --- | --- |
| **sweep** | finalises idle archives and ends sessions whose lease ran out | `maintain`, server schedule |
| **compact** | merges small archives into larger ones | `maintain`, server schedule |
| **gc** | rewrites archives holding dead objects | weekly, see [Garbage collection](/internals/garbage-collection/) |
| **scrub** / **repair** | rehashes every object / rewrites archives holding corrupt ones | by hand |

## Presence filters

`maintain` builds presence filters from the commits of a set, or of the whole store. Agents receive them and use them to skip asking the store about content it already holds.

## Sealing at rest

With `--at-rest-key`, a local, `gcs://` or `s3://` store seals each archive where it is stored. This is independent of the store key, which encrypts names and contents on the agent before upload. `goback key at-rest --rotate` adds a new primary key. Earlier keys still open what they sealed.
