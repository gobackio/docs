---
title: Quick start, self-hosted
description: Install, make a key, back up a directory to your own bucket.
---

## Install

```sh
go install github.com/gobackio/goback/cmd/goback@latest
```

## Make a store key

```sh
goback key new my-store
```

This writes `store.key`, which encrypts names and contents before they leave the machine. **Without it, your backups can't be restored.** To keep the key in the store under a passphrase instead, see [Keys](/self-host/keys/).

## Point at a store

```sh
export GOBACK_STORAGE=/backups/store GOBACK_INDEX=/backups/index
```

| `GOBACK_STORAGE` | Store |
| --- | --- |
| `/path` | a local directory |
| `gcs://bucket` | Google Cloud Storage |
| `s3://bucket?endpoint=…` | an S3-compatible bucket |
| `goback://<secret>@host:port` | a [goback server](/self-host/server/) |

`GOBACK_INDEX` is a directory for a SQLite index, or a `postgres://` URL. Leave it out when you back up to a goback server, which keeps its own index. See [Storage and index](/self-host/storage/).

## Back up

```sh
goback --store-key store.key --set home commit new ~/
```

`home` is the set, a series of snapshots of one directory. Later commits upload only what changed.

## List

```sh
goback --store-key store.key --set home commit list
```

## Next

- [Restore](/start/restore/)
- [Retention and maintenance](/self-host/retention/): run `goback maintain` from cron.
- [The agent](/self-host/agent/): run a machine's backups on their schedules from one config file.
