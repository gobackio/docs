---
title: Restore
description: Bring back a whole snapshot, one file, or a file as it was at any age.
---

A restore updates the target in place and downloads only the data the target doesn't already have. The examples use a store key file. With goback cloud, set `GOBACK_STORAGE` and `GOBACK_PASSPHRASE` as in the [quick start](/start/cloud/) and leave out `--store-key`.

## A whole snapshot

```sh
goback --store-key store.key --set home commit restore ~/restored          # the latest
goback --store-key store.key --set home commit restore ~/restored 24h      # as it was a day ago
goback --store-key store.key --set home commit restore --at 2026-10-01T00:00:00Z ~/restored
```

| Flag | Does |
| --- | --- |
| `--dry-run` | report what would change without writing |
| `--delete` | also remove files the commit does not contain |
| `--verify` | rehash every written file before it replaces the destination |
| `--ref <hex>` | restore exactly this commit |
| `--from <path>` | restore only the subtree at this path of the commit |
| `--salvage` | write what can be read when parts are missing, leaving holes, and report them |

A restore also works into read-only directories. goback makes each directory writable while it writes into it, then sets the mode from the snapshot. A directory that isn't in the snapshot keeps its own mode.

## One file

Paths are relative to the directory the set backs up:

```sh
goback --store-key store.key --set home file ls projects 7d
goback --store-key store.key --set home file restore projects/notes.md ./notes.md 7d
```

With goback cloud, you can also find the path by browsing the snapshot in the console. Names are decrypted in your browser.

## Download less

| Flag | Does |
| --- | --- |
| `--seed <path>` | use chunks from a local file or directory instead of downloading them |
| `--overwrite if-changed` | trust a size and mtime match instead of hashing every part |
| `--rechunk` | `file restore` only: find parts that moved inside the existing file instead of downloading them |

The global flag `--cache-dir <dir>` (or `GOBACK_CACHE_DIR`) goes before the command. With it, a restore reuses data this machine already downloaded or uploaded.

## When the index is gone

On a new machine, you need only the store and the key. Run [`goback fix`](/reference/cli/goback-fix/) to rebuild the index from the store, then restore as above. See [Self-contained backups](/concepts/self-contained/).
