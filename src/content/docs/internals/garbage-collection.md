---
title: Garbage collection
description: How unreachable objects are found and removed.
---

`goback gc` runs a collection; `goback maintain` runs one once the last is older than `--gc-interval` (7 days).

## Mark

A collection takes a snapshot of the store's archives and marks every object reachable from the roots: live commits and pins. Each run is a numbered generation.

## Drop rule

| Rule | Default |
| --- | --- |
| an object is dropped only after **two consecutive generations** leave it unmarked | |
| an object younger than this is kept whatever the mark says | 24 h |

## Sweep

An archive is rewritten without its dropped objects when

| Condition | Default |
| --- | --- |
| this share of its bytes is dead | 30 % |
| it has held dead objects this long, whatever the share | 14 days |

## Quarantine

The files of a rewritten archive are not deleted right away. They are marked retired and kept for a quarantine period, then a later collection deletes them.

| | Default |
| --- | --- |
| quarantine | 24 h |
