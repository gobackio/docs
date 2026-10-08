---
title: The database is only an index
description: Everything a restore needs lives in the store. Losing any database never loses a backup.
---

goback keeps an SQLite or Postgres index next to the store so that listing commits, finding files and planning backups is fast. It is never the only copy of anything.

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

## What this rules out

Nothing goback needs for a restore may exist only in a database: not keys, not set membership, not which commits are deleted. A change that would need one is a bug.
