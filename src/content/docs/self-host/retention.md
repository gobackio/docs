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

Each run removes the commits that retention or the trash let go, compacts small archives, splits old archives and does other housekeeping. When the last garbage collection is older than `--gc-interval`, the run also collects garbage. A [server](/self-host/server/) does all of this on its own schedule. When one job fails, the run still does the others and exits with the error.

A split rewrites archives over a week old that hold file data beside metadata into archives that hold one or the other. It takes the oldest first and rewrites at most 30 GB a run. Garbage collection then skips the archives that hold only file data, so a bucket that moves objects nobody reads to a colder storage class, such as GCS Autoclass or S3 Intelligent-Tiering, can move the file data. A server splits once a day. `goback maintain split --age 72h --budget 100GB` runs one with other limits.

A collection checks the Go runtime's memory limit before it marks. With `GOMEMLIMIT` set, a collection that wouldn't fit beside what the process already holds stops with `the memory limit leaves too little room to collect`, and frees nothing. Raise the limit for that run, or leave `GOMEMLIMIT` unset.

Only one process maintains a store at a time. `goback gc`, `maintain`, `repair`, `reseal` and `commit unretire` hold a lease in the store while they work. One that finds another process holding it does nothing and says so; with `--json` it reports `busy`. A lease left by a process that stopped is taken over after an hour.

## Integrity

| Command | Does |
| --- | --- |
| `goback scrub` | rehash every stored object |
| `goback repair` | rewrite the archives holding corrupt ones |
| `goback fix` | rebuild the index from the store |
| `goback maintain check` | list the commits in the store that the index has no row for |
| `goback maintain drop-orphans` | tombstone the commits `check` lists |
| `goback reseal` | name chunks sealed before v1.96.0 so the store can check them; see [Resealing a store](/self-host/reseal/) |

Every collection keeps a commit that the index has no row for, and everything the commit reaches. From v1.108.0 on, a commit or pin that the store takes but the index fails to record is tombstoned. Before that, it stayed in the store. Run `goback maintain drop-orphans` once to see the commits left over from earlier versions, then again with `--apply` to tombstone them. It leaves out commits received in the last 24 hours, which may still be on their way into the index; `--age` changes that window.

See [Snapshot lifecycle](/internals/lifecycle/) and [Garbage collection](/internals/garbage-collection/).
