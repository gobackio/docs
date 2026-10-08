---
title: Storage and index
description: Where goback keeps objects, and the index that answers queries about them.
---

## Storage

`--storage` (or `GOBACK_STORAGE`) names where objects live. It has no default.

| Value | Store |
| --- | --- |
| `/path` | a local directory |
| `gcs://bucket` | Google Cloud Storage, with the usual Google credentials |
| `s3://bucket?endpoint=…` | anything S3-compatible |
| `goback://<secret>@host:port` | a [goback server](/self-host/server/) over TLS |
| `goback+insecure://<secret>@host:port` | a server on this machine with no TLS in front of it |

## Index

`--index` (or `GOBACK_INDEX`) is where a directory or bucket store keeps its index: a directory for SQLite, or a `postgres://` URL. Agents of a server need none; the server keeps it.

The index can always be rebuilt from the store with [`goback fix`](/reference/cli/goback-fix/). See [The index is rebuildable](/concepts/index-only/).

## Cache

`--cache-dir` (or `GOBACK_CACHE_DIR`) names a per-machine directory for every cache:

| Cache | Saves |
| --- | --- |
| stat and tree caches | a backup skips unchanged files |
| blob cache | a restore downloads less; trimmed to `--blob-cache-size` (4GB) |
| archive metadata | opening a bucket store reads less |

Without it, nothing is cached.
