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

From v1.113.0, with `--cache-dir`, `fix` first reads the commits, trees and files of every archive in the bucket into the metadata cache, sixteen archives at a time. The rebuild then reads them from the cache rather than the bucket.

After the rebuild, `fix` checks that the store still holds every object the indexed versions reference. From v1.113.0, it prints what is missing. With `--json`, the counts are in `damage`:

| Field | Counts |
| --- | --- |
| `paths` | paths the next backups read again |
| `lost` | versions that can't be recovered |
| `rescan` | sets the next backup reads in full |
| `unplaced` | missing objects that no indexed path holds |
