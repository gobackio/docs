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

This writes `store.key`. Names and contents are encrypted with it before they leave the machine. **Keep a copy elsewhere: without it, nothing can be restored.** To keep it in the store under a passphrase instead, see [Keys](/self-host/keys/).

## Point at a store

```sh
export GOBACK_STORAGE=/backups/store GOBACK_INDEX=/backups/index
```

| `GOBACK_STORAGE` | Store |
| --- | --- |
| `/path` | a local directory |
| `gcs://bucket` | Google Cloud Storage |
| `s3://bucket?endpoint=…` | anything S3-compatible |
| `goback://<secret>@host:port` | a [goback server](/self-host/server/) |

`GOBACK_INDEX` is a directory for SQLite or a `postgres://` URL. A server keeps its own, so agents of a server need none. See [Storage and index](/self-host/storage/).

## Back up

```sh
goback --store-key store.key --set home commit new ~/
```

A set is a series of snapshots of one thing. The first commit uploads everything; the next only what changed.

## List

```sh
goback --store-key store.key --set home commit list
```

## Next

- [Restore](/start/restore/)
- [Retention and maintenance](/self-host/retention/): run `goback maintain` from cron.
- [The agent](/self-host/agent/): run a machine's backups on their schedules from one config file.
