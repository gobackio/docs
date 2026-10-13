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

## Quarantine

The files of a rewritten archive aren't deleted right away. They are marked retired and kept for a quarantine period (24 hours by default). A later collection then deletes them.
