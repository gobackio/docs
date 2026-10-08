---
title: Snapshot lifecycle
description: Trash, tombstones, pins, and when a snapshot's data is finally deleted.
---

| State | How it gets there | Back with |
| --- | --- | --- |
| **live** | `commit new` | |
| **trash** | `commit delete` or `set delete`; waits `--trash-days` | `commit undelete`, `set undelete` |
| **tombstoned** | the retention policy lets it go, or the trash window ends; applied by retirement | `commit unretire`, until collected |
| **collected** | garbage collection finds none of its objects reachable from a live commit or pin | — |

`set delete --erase` skips the trash window.

## Retirement

Retirement runs on every `maintain` (and on a server's schedule). It evaluates each set's policy and writes tombstones for the commits it lets go. Tombstones are stored in the bucket, so a rebuilt index applies them again.

## Pins

A pin keeps a commit live whatever the policy says. Pins are objects in the store and count as roots for garbage collection.
