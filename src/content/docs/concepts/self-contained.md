---
title: Self-contained backups
description: Everything a restore needs is in the bucket.
---

A store holds everything a restore needs: the data, its metadata and escrowed keys. The SQLite or Postgres index next to it only makes listing and planning fast; it is rebuilt from the store when it is missing.

| In the bucket |
| --- |
| file contents and metadata |
| every snapshot of every set |
| escrowed store keys |

## Rebuilding

On a new machine, or after the index is lost:

```sh
goback --storage gcs://my-bucket --index /var/lib/goback/index fix
```

`fix` reads the bucket and writes a fresh index.
