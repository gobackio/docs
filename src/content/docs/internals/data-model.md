---
title: Data model
description: Commits, trees, files and chunks, content-addressed and packed into archives.
---

Objects are content-addressed by SHA-256, like git's.

| Object | Holds |
| --- | --- |
| **commit** | one snapshot of a set: its tree, when, and which agent |
| **tree** | a directory: names pointing at files and subtrees |
| **file** | the chunks a file is made of, in order |
| **chunk** | a piece of content, cut with FastCDC |

FastCDC cuts at content-defined boundaries, so an edit changes only the chunks around it, and the same chunk is stored once across files, commits and sets. A backup uploads only what the store does not already hold; a restore downloads only what the target does not already hold.

## Archives

Objects are packed into archives, each with its own index of what it holds. Compaction merges small archives; garbage collection rewrites archives that are mostly dead.

## Sets

A set is a named series of commits: one machine's home directory, one database's WAL. Retention is per set; deduplication is across the whole store. Names group sets: see [Sets](/concepts/sets/).
