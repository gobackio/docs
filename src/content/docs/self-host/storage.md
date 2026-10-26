---
title: Storage and index
description: Where goback keeps objects, and the index that answers queries about them.
---

## Storage

`--storage` (or `GOBACK_STORAGE`) sets where goback stores backups. There is no default.

| Value | Store |
| --- | --- |
| `/path` | a local directory |
| `gcs://bucket` | Google Cloud Storage, using Application Default Credentials such as `GOOGLE_APPLICATION_CREDENTIALS` |
| `s3://bucket?endpoint=…` | an S3-compatible bucket |
| `goback://<secret>@host:port` | a [goback server](/self-host/server/) over TLS |
| `goback+insecure://<secret>@host:port` | a server on this machine with no TLS in front of it |

A path after a bucket keeps the store under that prefix: `gcs://my-bucket/web1` and `gcs://my-bucket/web2` are two stores in one bucket. Before v1.96.0, goback ignored that path and opened the bucket's root, so drop the path from a location that names a store kept at the root. A value that doesn't start with a scheme and `://` is a path as written, `#` and `?` included.

Only `goback commit new` creates a store or index directory that doesn't exist. Every other command, the agent and the server refuse a missing one, so a backup disk that isn't mounted isn't taken for an empty store.

## Index

`--index` (or `GOBACK_INDEX`) sets where the index is kept: a directory for a SQLite index, or a `postgres://` URL. Leave it out when you use a goback server, which keeps its own index.

[`goback fix`](/reference/cli/goback-fix/) rebuilds the index from the store at any time. See [Self-contained backups](/concepts/self-contained/).

## Cache

`--cache-dir` (or `GOBACK_CACHE_DIR`) sets a directory on this machine for all of goback's caches. Without it, goback caches nothing.

| Cache | Effect |
| --- | --- |
| stat and tree caches | a backup skips unchanged files |
| blob cache | a restore downloads less; trimmed to `--blob-cache-size` (4GB) |
| archive metadata | opening a bucket store reads less |
