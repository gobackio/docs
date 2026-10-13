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
| **chunk** | a piece of content, cut with FastCDC |

FastCDC cuts at boundaries that depend on the content, so an edit changes only the chunks around it. The same chunk is stored once across files, commits and sets. A backup uploads only what the store doesn't already hold, and a restore downloads only what the target doesn't already hold.

## Archives

Objects are packed into archives, and each archive has its own index of what it holds. Compaction merges small archives. Garbage collection rewrites archives that are mostly dead.

## Sets

A set is a named series of commits, such as one machine's home directory or one database's WAL. Each set has its own retention. Deduplication works across the whole store. Names group sets, as described in [Sets](/concepts/sets/).
