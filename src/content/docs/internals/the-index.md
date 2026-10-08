---
title: The index
description: What the SQLite or Postgres index holds and how it is rebuilt.
---

The index makes listing commits, finding files and planning backups fast. Everything in it is derived from the store.

| Holds | Derived from |
| --- | --- |
| sets and their commits | commits and set heads in the bucket |
| which archive holds which object | the archives' own indexes |
| file versions and sizes | trees and files |
| retention state | tombstones in the bucket |

## Rebuilding

```sh
goback --storage gcs://my-bucket --index /var/lib/goback/index fix
```

`fix` reads the archives and set heads and writes a fresh index. Commits that name no set go to a placeholder set.
