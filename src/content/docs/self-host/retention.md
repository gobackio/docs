---
title: Retention and maintenance
description: Which snapshots a set keeps, and the housekeeping that frees what it lets go.
---

## Retention

A set keeps the last commit of each calendar hour, day, week or month, by brackets counted back from now, newest first:

```sh
goback set retention home \
  --keep hourly=336 --keep daily=60 --keep weekly=12 --keep monthly
```

The last bracket may drop its count to keep forever. Without a name, `set retention` shows or changes the store's defaults; `--inherit` drops a set's own policy.

## What happens to a commit

| Stage | Reversible |
| --- | --- |
| deleted by hand: waits in the trash (`--trash-days`) | `commit undelete` |
| expired by the policy: removed from the set at the next `maintain` run | `commit unretire`, until collected |
| no live commit or pin reaches its objects: garbage collected | no |

[`goback pin`](/reference/cli/goback-pin/) keeps a commit regardless of retention.

## Maintenance

Without a server, run `goback maintain` from cron, say hourly:

```sh
0 * * * * goback maintain
```

Every run sweeps, retires, compacts and builds presence filters; it collects garbage once the last collection is older than `--gc-interval`. A [server](/self-host/server/) runs all of this itself.

## Integrity

| Command | Does |
| --- | --- |
| `goback scrub` | rehash every stored object |
| `goback repair` | rewrite the archives holding corrupt ones |
| `goback fix` | rebuild the index from the store |

Details: [Snapshot lifecycle](/internals/lifecycle/), [Garbage collection](/internals/garbage-collection/).
