---
title: Data model
description: Commits, trees, files and chunks, content-addressed and packed into archives.
---

Every object is addressed by a SHA-256 hash derived from its content.

| Object | Holds |
| --- | --- |
| **commit** | one snapshot of a set: its tree, when, and which agent |
| **tree** | a directory: names pointing at files and subtrees |
| **file** | the chunks a file is made of, in order |
| **chunk** | a piece of content, cut with FastCDC at the store's chunk size |

The same chunk is stored once across files, commits and sets. A backup uploads only what the store doesn't already hold. Postgres base backups and MySQL dumps upload only what changed since the previous one from v1.119.0, and in full before. A restore downloads only what the target doesn't already hold.

## Chunk size

goback cuts content into chunks of about 64 KiB, from 16 KiB to 256 KiB. From v1.124.0, a store's policy can name its own target chunk size, a power of two from 64 KiB to 1 MiB. Chunks are then cut from a quarter of the target to four times it, so a 1 MiB target cuts chunks from 256 KiB to 4 MiB.

The server's Admin service sets the size with `SetStorePolicy`, which takes the admin key. It changes only while the store holds no commit. Once a commit exists, every later file must be cut the same way for its content to dedup against what the store holds, so `SetStorePolicy` refuses with `the chunk size changes only while the store holds no commit`. Agents and restores read the size from the store and need no setting of their own. A server whose store names a size refuses agents before v1.124.0, as [Upgrading](/self-host/server/#upgrading) says.

## Archives

Objects are packed into archives, and each archive has its own index of what it holds. Compaction merges small archives. Garbage collection rewrites archives that are mostly dead.

## Sets

A set is a named series of commits, such as one machine's home directory or one database's WAL. Each set has its own retention. Deduplication works across the whole store. Names group sets, as described in [Sets](/concepts/sets/).
