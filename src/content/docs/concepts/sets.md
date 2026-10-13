---
title: Sets
description: Named series of snapshots, grouped by their names.
---

A set is a named series of commits, such as one machine's home directory, one database's base backups or its WAL. Every commit belongs to one set. Each set has its own retention. Deduplication works across the whole store.

## Names

A set name can be any text except a plain number, because numbers refer to sets by id.

A `/` in a name puts the set in a group. `shop/dump` and `shop/binlog` are both in the group `shop`. `eu/shop/dump` is in both `eu/shop` and `eu`.

A group isn't stored as anything of its own and holds no commits. It exists as long as some set's name starts with it. A set can have the same name as a group: `shop` and `shop/dump` can both exist.

[The agent](/self-host/agent/) puts a database backup's sets in a group named after the backup. A backup named `shop` writes `shop/base` and `shop/wal` for Postgres, or `shop/dump` and `shop/binlog` for MySQL.

In goback cloud, an API key bound to a set can also write every set in its group. A key bound to `shop` can write `shop`, `shop/dump` and `shop/binlog`, but not `shop-dump`. The console lists a group's sets together.
