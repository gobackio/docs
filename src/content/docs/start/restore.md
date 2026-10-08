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

## One file

```sh
goback --store-key store.key --set home file ls ~/projects 7d
goback --store-key store.key --set home file restore ~/projects/notes.md ./notes.md 7d
```

With goback cloud you can also browse a snapshot in the console and download a file; it is decrypted in your browser.

## Download less

| Flag | Does |
| --- | --- |
| `--seed <path>` | use chunks from a local file or directory instead of downloading them |
| `--cache-dir <dir>` | reuse blobs this machine already fetched or uploaded |
| `--overwrite if-changed` | trust a size and mtime match instead of hashing every part |

## When the index is gone

A new machine needs only the store and the key. Run [`goback fix`](/reference/cli/fix/) to rebuild the index from the store, then restore as above. See [The database is only an index](/concepts/index-only/).
