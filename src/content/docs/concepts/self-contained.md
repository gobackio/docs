---
title: Self-contained backups
description: Everything a restore needs is in the bucket.
---

A store holds everything a restore needs: the data, its metadata and escrowed keys. The SQLite or Postgres index next to it only makes listing and planning fast; it is rebuilt from the store when it is missing.

| Lives in the store | Rebuilt from the store |
| --- | --- |
| every object and archive | commits and sets |
| each archive's own index | which archive holds which object |
| set heads | file versions and sizes |
| escrowed store keys | retention state, tombstones |

## Rebuilding

On a new machine, or after the index is lost:

```sh
goback --storage gcs://my-bucket --index /var/lib/goback/index fix
```

`fix` reads the archives and set heads and writes a fresh index. Commits that name no set go to a placeholder set.
