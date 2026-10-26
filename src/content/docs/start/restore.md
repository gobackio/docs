---
title: Restore
description: Bring back a whole snapshot, one file, or a file as it was at any age.
---

A restore updates the target in place and downloads only the data the target doesn't already have. With goback cloud, set `GOBACK_STORAGE` and `GOBACK_PASSPHRASE` as in the [quick start](/start/cloud/) and leave out `--store-key`.

## A whole snapshot

```sh
goback --store-key store.key --set home commit restore ~/restored          # the latest
goback --store-key store.key --set home commit restore ~/restored 24h      # as it was a day ago
goback --store-key store.key --set home commit restore --at 2026-10-01T00:00:00Z ~/restored
```

| Flag | Does |
| --- | --- |
| `--dry-run` | report what would change without writing |
| `--delete` | also remove files the commit does not contain. Without `--force`, it refuses the working directory, a filesystem root, and a commit the store lost entries of |
| `--verify` | rehash every written file before it replaces the destination |
| `--ref <hex>` | restore exactly this commit |
| `--from <path>` | restore only the subtree at this path of the commit |
| `--salvage` | write what can be read when parts are missing, leaving holes, and report them |
| `--owner recorded` | as root, give each entry the user and group it was backed up with |
| `--escape-names` | restore an entry whose name this system can't hold under an escaped name ending in `.goback-escaped` |

A restore works into read-only directories and sets each directory's mode from the snapshot. A directory that isn't in the snapshot keeps its own mode.

A restore assembles each file in a `.goback-restore` directory inside the directory the file goes into, then renames it into place. It removes these directories once the files are in place. After a failed restore they stay behind, and the next restore into the same place picks up from them.

On Linux and macOS, a backup records each entry's extended attributes, including POSIX ACLs and file capabilities, its file flags, and which paths are hard links to the same file. A restore sets them again and makes the hard links. Its summary counts what the restoring user or the target filesystem can't set. A sparse file of 64 MiB or more is stored with its holes, and restored sparse.

With `--owner recorded`, an entry whose user or group has no account on this machine gets its recorded uid or gid. A file that doesn't get its recorded owner comes back without its setuid and setgid bits.

A restore leaves out an entry whose name the system can't hold, such as `aux` or a name with `:` on Windows, unless you pass `--escape-names`. It exits non-zero when it left entries out, or when the store lost part of the commit.

## One file

Paths are relative to the directory the set backs up:

```sh
goback --store-key store.key --set home file ls projects 7d
goback --store-key store.key --set home file restore projects/notes.md ./notes.md 7d
```

With goback cloud, you can also browse the snapshot in the console, which decrypts names in your browser.

## Download less

| Flag | Does |
| --- | --- |
| `--seed <path>` | use chunks from a local file or directory instead of downloading them |
| `--overwrite if-changed` | trust a size and mtime match instead of hashing every part |
| `--rechunk` | `file restore` only: find parts that moved inside the existing file instead of downloading them |

With the global flag `--cache-dir <dir>` (or `GOBACK_CACHE_DIR`), a restore reuses data this machine already downloaded or uploaded.

## When the index is gone

A restore on a new machine needs only the store and the key. Run [`goback fix`](/reference/cli/goback-fix/) to rebuild the index from the store, then restore as above. See [Self-contained backups](/concepts/self-contained/).
