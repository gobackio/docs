---
title: Resealing a store
description: Rename the chunks sealed before v1.96.0, so the store can check every one it holds.
---

`goback reseal` rewrites the sealed chunks of a store written before v1.96.0. Run it once on such a store after you upgrade.

Before v1.96.0, a chunk sealed under a store key was named by a keyed hash of its contents, which the store can't check without the key. From v1.96.0 on, a sealed chunk is named by the hash of its sealed bytes, so the store checks each one it receives as it checks everything else. Until a store is resealed, its old chunks still restore as before. New backups name the same data differently, though, so the first time a file changes after the upgrade, its unchanged chunks are uploaded again.

```sh
goback --storage gcs://my-bucket --index /var/lib/goback/index --store-key store.key reseal
```

## What it changes

- Each old chunk is opened with the store key, checked, and stored under its new name. The files and directories above it are written again over the new names.
- Each commit that reaches an old chunk is replaced by a commit with the same time, set, agent and labels, under a new ref. Its pins move to the replacement.
- The replaced commits are retired, and the next garbage collection frees the old chunks. Until then the store holds both copies.
- The index follows each replacement as it happens. It needs no rebuild and keeps each set's retention policy, trash and other state.
- Commits written without a store key are left alone. A commit it can't reseal, such as one sealed under another store key, is left as it was and listed with the reason.

## Running it

- It works on the store and its index directly, as `gc` and `maintain` do. A `goback://` server can't be resealed through its URL; run the command on the server's machine against the store.
- It holds the store's maintenance lease. When another process is maintaining the store, it does nothing and says so.
- A run that stops part way carries on when you run it again. A run over a store that is already resealed replaces nothing.

It prints a summary of the commits and chunks it resealed, the pins it moved and the commits it found current, then each commit it left as it was and why. With `--json`, it prints `resealed`, each replaced commit's `old` and `new` ref with its moved `pins`; the counts `current`, `blobs` and `pins`; `moved`, the pins of trees and files; `failed`, each with its `ref` and `error`; and `busy` when another process held the lease.
