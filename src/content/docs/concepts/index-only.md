---
title: The index is rebuildable
description: Keys and restore data are stored in the bucket; the index is rebuilt from it.
---

goback keeps an SQLite or Postgres index next to the store so that listing commits, finding files and planning backups is fast. Everything in it can be rebuilt from the store.

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
