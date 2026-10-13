---
title: Sets
description: Named series of snapshots, grouped by their names.
---

A set is a named series of commits: one machine's home directory, one database's base backups, its WAL. Every commit belongs to one set. Retention is per set; deduplication spans the whole store.

## Names

A set's name is any text but digits alone, which name sets by id. `/` groups sets: `shop/dump` and `shop/binlog` are both in the group `shop`, and `eu/shop/dump` is in `eu/shop` and in `eu`.

A group is no object of its own. It exists while a set's name starts with it, and holds no commits. A set may have a group's name too: `shop` and `shop/dump` can both exist.

[The agent](/self-host/agent/) writes a database backup's sets in a group of the backup's name: a backup named `shop` writes `shop/base` and `shop/wal` for Postgres, `shop/dump` and `shop/binlog` for MySQL.
