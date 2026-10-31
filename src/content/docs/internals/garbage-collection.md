---
title: Garbage collection
description: How unreachable objects are found and removed.
---

`goback gc` runs a collection. `goback maintain` runs one when the last collection is older than `--gc-interval` (7 days by default).

## Mark

A collection takes a snapshot of the store's archives and marks every object reachable from the roots: live commits and pins. Each run is a numbered generation.

## Drop rule

An object is dropped only after **two consecutive generations** leave it unmarked. An object younger than a minimum age (24 hours by default) is kept, whatever the mark says.

## Sweep

An archive is rewritten without its dropped objects when a share of its bytes is dead (30 % by default). An archive that has held dead objects for long enough (14 days by default) is rewritten whatever the share.

Every rewrite, whether by a sweep, a compaction or a split, writes archives that hold either file data or metadata, never both. The mark doesn't read archives that hold only file data. A split rewrites the older archives that still mix the two; see [Maintenance](/self-host/retention/#maintenance).

## Check before deleting

Before it deletes anything, a collection marks again from the archives and roots the store holds by then. If an object it was about to drop is reachable, it deletes nothing and halts. It leaves a `collection.halt` file in the store, naming its generation and the reachable copies. While that file exists, no collection drops anything. Delete it once you know the cause; a Go program calls `PackStorage.Resume`.

## Quarantine

The files of a rewritten archive aren't deleted right away. They are marked retired and kept for a quarantine period (24 hours by default). A collection moves the files of archives retired at least a day before into the quarantine, under `pack/.quarantine/` in a bucket, so listing the archives skips them. A later collection deletes them.
