---
title: Retention and maintenance
description: Which snapshots a set keeps, and the housekeeping that frees what it lets go.
---

## Retention

A retention policy keeps the last commit of each calendar hour, day, week, month or year. Each `--keep` bracket covers a number of these periods. The brackets run back from now one after the other, newest first:

```sh
goback set retention home \
  --keep hourly=336 --keep daily=60 --keep weekly=12 --keep monthly
```

With this policy, the set keeps one commit per hour for the last 336 hours, then one per day for the 60 days before that, then one per week for 12 weeks. Older commits are kept one per month. The last bracket can leave out its count to keep its commits forever.

`--keep-last <n>` also keeps the newest `n` commits. `--keep-within <duration>` keeps every commit younger than that. Without a set name, `set retention` shows or changes the store's default policy. `--inherit` removes a set's own policy, so the store's default applies again.

If neither the set nor the store has a policy, the set keeps every commit.

## What happens to a commit

| Stage | Undo with |
| --- | --- |
| deleted by hand: waits in the trash (`--trash-days`) | `commit undelete` |
| expired by the policy: removed from the set at the next `maintain` run | `commit unretire`, until collected |
| no live commit or pin reaches its objects: garbage collected | can't be undone |

[`goback pin`](/reference/cli/goback-pin/) keeps a commit regardless of retention.

## Maintenance

Without a server, run `goback maintain` from cron:

```sh
0 * * * * GOBACK_STORAGE=/backups/store GOBACK_INDEX=/backups/index goback maintain
```

Cron starts jobs with an almost empty environment, so name the store and index on the line, or in the crontab above it.

Each run removes the commits that retention or the trash let go, compacts small archives and does other housekeeping. When the last garbage collection is older than `--gc-interval`, the run also collects garbage. A [server](/self-host/server/) does all of this on its own schedule.

## Integrity

| Command | Does |
| --- | --- |
| `goback scrub` | rehash every stored object |
| `goback repair` | rewrite the archives holding corrupt ones |
| `goback fix` | rebuild the index from the store |

See [Snapshot lifecycle](/internals/lifecycle/) and [Garbage collection](/internals/garbage-collection/).
