---
title: Restore
description: Bring back a whole snapshot, one file, or a file as it was at any age.
---

A restore writes in place and downloads only what the target does not already hold. The examples use a store key file; with goback cloud, set `GOBACK_STORAGE` and `GOBACK_PASSPHRASE` as in the [quick start](/start/cloud/) and drop `--store-key`.

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

Read-only directories in the target don't stop a restore: each is writable while it is written, then takes the snapshot's mode, or keeps its own when the snapshot doesn't hold it.

## One file

Paths are relative to the directory the set backs up:

```sh
goback --store-key store.key --set home file ls projects 7d
goback --store-key store.key --set home file restore projects/notes.md ./notes.md 7d
```

With goback cloud you can also browse a snapshot in the console to find the path; names are decrypted in your browser.

## Download less

| Flag | Does |
| --- | --- |
| `--seed <path>` | use chunks from a local file or directory instead of downloading them |
| `--overwrite if-changed` | trust a size and mtime match instead of hashing every part |
| `--rechunk` | `file restore` only: find parts that moved inside the existing file instead of downloading them |

`--cache-dir <dir>` (or `GOBACK_CACHE_DIR`), a global flag before the command, reuses blobs this machine already fetched or uploaded.

## When the index is gone

A new machine needs only the store and the key. Run [`goback fix`](/reference/cli/goback-fix/) to rebuild the index from the store, then restore as above. See [Self-contained backups](/concepts/self-contained/).
