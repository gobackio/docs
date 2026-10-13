---
title: Self-contained backups
description: Everything a restore needs is in the bucket.
---

The bucket holds file contents and metadata, every snapshot of every set, and the escrowed store keys. With the store key or its passphrase, that is all a restore needs.

The SQLite or Postgres index next to the store only speeds up listing and planning. See [The index](/internals/the-index/).

## Rebuilding

On a new machine, or after the index is lost, `goback fix` rebuilds the index from the bucket:

```sh
goback --storage gcs://my-bucket --index /var/lib/goback/index fix
```
