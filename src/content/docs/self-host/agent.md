---
title: The agent
description: Run a machine's backups on their schedules from one config file.
---

`goback agent run` runs all of a machine's backups in one long-running process. You list the directories, Postgres clusters and MySQL servers in a YAML file, together with the store they go to.

```sh
goback agent check --config /etc/goback/goback.yaml   # validate, open the store, check the databases
goback agent run --config /etc/goback/goback.yaml     # run until SIGTERM; SIGHUP reloads the backups
goback agent status --config /etc/goback/goback.yaml  # what the running agent last wrote
```

You can set `GOBACK_CONFIG` instead of passing `--config`.

## A config file

```yaml
store:
  storage: gcs://my-bucket
  index: /var/lib/goback/index
  store-key: /etc/goback/store.key
  cache-dir: /var/cache/goback

schedule:
  concurrency: 2
  shutdown-grace: 30s

backups:
  - name: home
    every: 1h
    jitter: 10m
    path:
      dir: /home

  - name: srv
    cron: "30 2 * * *"
    timeout: 6h
    path:
      dir: /srv
      pre-hook: /usr/local/bin/pause-writes
      post-hook: /usr/local/bin/resume-writes
      meta:
        host: web-1

  - name: db
    postgres:
      dbname: host=127.0.0.1 port=5432 user=goback dbname=postgres

  - name: shop
    cron: "0 */6 * * *"
    mysql:
      defaults-extra-file: /etc/goback/mysql-client.cnf
      window: 168h
```

An unknown key in the file is an error. `agent check` lists all problems at once. Write durations as `30s`, `10m` or `6h`. There is no unit for days.

## store

Each key sets the global flag of the same name. A flag or its environment variable overrides the file. `agent check` and `agent run` report each override. A key you leave out takes the flag's default.

| Key | Flag, variable | Default |
| --- | --- | --- |
| `storage` | `--storage`, `GOBACK_STORAGE` | required here or as a flag |
| `index` | `--index`, `GOBACK_INDEX` | required unless `storage` is a server |
| `store-key` | `--store-key` | |
| `passphrase-file` | `--passphrase`, `GOBACK_PASSPHRASE` | a file holding the passphrase of the escrowed store key |
| `at-rest-key` | `--at-rest-key` | |
| `agent-id` | `--agent-id` | the hostname |
| `cache-dir` | `--cache-dir`, `GOBACK_CACHE_DIR` | |
| `metadata-cache-size` | `--metadata-cache-size` | `1GiB`; `0` for no bound |
| `blob-cache-size` | `--blob-cache-size` | `4GB`; `0` for no bound |
| `blob-cache-on-backup` | `--blob-cache-on-backup` | `true` |

The agent rejects a `goback://` storage URL in the file that contains the server's secret. Put the secret in a file and name it with `?key-file=`, for example `goback://backup.example.com?key-file=/etc/goback/secret`. See [Storage and index](/self-host/storage/) and [Encryption and keys](/self-host/keys/).

## schedule

| Key | Default | |
| --- | --- | --- |
| `concurrency` | `2` | full backups running at once, at least 1. WAL and binlog receivers don't count |
| `shutdown-grace` | `30s` | how long running backups get after SIGTERM before they are cancelled; receivers make a last commit within it |
| `state-dir` | `<cache-dir>/schedule` | holds the status file and a lock, so only one agent runs on it; required without `cache-dir` |

## backups

Each entry names one thing to back up and sets exactly one of `path`, `postgres` and `mysql`.

| Key | Default | |
| --- | --- | --- |
| `name` | required | unique. It names the backup's sets; slashes put them in [groups](/concepts/sets/), as in `srv1/db` |
| `every` | | run this long after the last run started |
| `cron` | | five fields, or `@hourly`, `@daily`, `@weekly`, `@monthly`, in the system's time zone |
| `jitter` | `0` | shift every run by a fixed offset up to this long. The offset stays the same across restarts and differs per agent and backup |
| `timeout` | none | cancel a run after this long |

Set `every` or `cron`, not both. A path backup needs one of them. A database backup without either runs every day at 03:00. These keys schedule the full backups only. WAL and binlog receivers run all the time.

A backup that has never run, or that missed a run while the agent was down, runs right away. The agent takes a backup's last run from the newest complete commit in its set, so a manual `goback commit new` counts too. A failed run is retried after a minute. The wait doubles after each failure, up to an hour, but a retry comes no later than the next planned run.

| Kind | Sets |
| --- | --- |
| `path` | `<name>` |
| `postgres` | `<name>/base`, and `<name>/wal` with `pitr` |
| `mysql` | `<name>/dump`, and `<name>/binlog` with `pitr` |

Two backups can't write to the same set.

### path

These are the settings of [`goback commit new`](/reference/cli/goback-commit/#commit-new).

| Key | Default | |
| --- | --- | --- |
| `dir` | required | the directory to back up |
| `include`, `exclude` | | globs matched against paths under `dir`, written with a leading `/`. An included path is backed up even if an exclude matches it |
| `workers` | the CPU count | files read and uploaded at once |
| `force-hash` | `0` | percent of unchanged files to re-hash as a check |
| `checkpoint-interval` | `30m` | write a partial commit this often, so an interrupted run keeps its progress |
| `scan-workers` | `4` | directories listed ahead of the walk |
| `read-retries` | `3` | re-reads of a file that changes while it is read |
| `lost-retries` | `1` | walks again when the store lost objects of the run |
| `progress-interval` | `15s` | how often the walk logs its progress; a negative value turns it off |
| `meta` | | `key: value` labels recorded in each commit |
| `pre-hook`, `post-hook` | | shell commands run before the walk, and after it whether it succeeded or not |
| `hook-timeout` | `5m` | deadline of each hook |
| `hook-optional` | `false` | back up anyway when the pre hook fails |

### postgres

These are the settings of [`goback postgres`](/reference/cli/goback-postgres/). The [Postgres page](/self-host/postgres/) lists the settings the cluster needs.

| Key | Default | |
| --- | --- | --- |
| `dbname` | the `PG*` environment variables | the connection string, as `key=value` pairs or a `postgres://` URL. It can't hold a password; use `.pgpass` or `PGPASSFILE` |
| `pg-basebackup` | | the `pg_basebackup` to run. Without it, goback takes base backups over its own replication connection on Postgres 15 and later. Older versions use the `pg_basebackup` on the `PATH` |
| `pitr` | `true` | stream the WAL into `<name>/wal` for point-in-time recovery |
| `window` | `336h` | how far back point-in-time recovery reaches at least |
| `commit-every` | `1m` | how often new WAL is committed; at least `10s` |
| `commit-bytes` | `256MiB` | how much new WAL makes the receiver commit early |
| `allow-uncapped-slot` | `false` | stream although `max_slot_wal_keep_size` is `-1` |
| `slot` | derived from `<name>/wal`, such as `goback_db_wal` for `db` | the replication slot |
| `spool` | `<state-dir>/spool/<name>/wal` | where WAL waits for its commit |

### mysql

These are the settings of [`goback mysql`](/reference/cli/goback-mysql/). The [MySQL page](/self-host/mysql/) lists the settings the server needs.

| Key | Default | |
| --- | --- | --- |
| `defaults-extra-file` | only `~/.my.cnf` | a MySQL option file read before the others, with the connection settings and password |
| `mysql`, `mysqldump` | `mysql`, `mysqldump` | the client programs to run; the dump runs on the agent's host |
| `pitr` | `true` | receive the binary log into `<name>/binlog`. The receiver starts after the first dump |
| `window` | `336h` | how far back point-in-time recovery reaches at least |
| `commit-every` | `1m` | how often new binlog is committed; at least `10s` |
| `commit-bytes` | `256MiB` | how much new binlog makes the receiver commit early |
| `server-id` | derived from `<name>/binlog` | the replica server id the receiver connects with |
| `spool` | `<state-dir>/spool/<name>/binlog` | where binlogs wait for their commit |
| `no-binlog-position` | `false` | with `pitr: false`, dumps record no binlog position and take no global read lock |

## Checking

`goback agent check --config <file>` validates the file, opens the store and the key, and prints each job with its plan, last run and next due time:

```text
JOB          KIND              PLAN              LAST RUN  NEXT DUE
home         path              every 1h0m0s      never     2026-10-13 12:18:56
srv          path              cron 30 2 * * *   never     2026-10-13 12:18:56
db/base      postgres-base     cron 0 3 * * *    never     2026-10-13 12:18:56
db/wal       postgres-receive  always            never     2026-10-13 12:18:56
shop/dump    mysql-dump        cron 0 */6 * * *  never     2026-10-13 12:18:56
shop/binlog  mysql-receive     always            never     2026-10-13 12:18:56
```

It also connects to each database and lists anything missing for the configured backup. For Postgres, it checks the version, the `REPLICATION` attribute, `max_slot_wal_keep_size`, a free slot and the `pg_hba.conf` lines. For MySQL, it checks `log_bin`, `server_id`, the privileges and a free server id. It exits with status 2 if it finds a problem.

## Status and health

A running agent writes `status.json` into its state dir at least once a minute. `goback agent status` prints it without contacting the store: each job's state, last start, result, last success, failures in a row and next due time. `--json` prints the file as JSON.

`goback agent status --check` is a health check. It exits 0 when healthy, 2 when there is no status to read, and 1 when:

- the agent stopped, or last wrote its status more than 3 minutes ago;
- a backup has not succeeded for three of its intervals;
- a receiver has not reported itself healthy for three times its `commit-every`.

## Reloading

On SIGHUP, the agent re-reads the file and applies the `backups` section. A changed backup is rescheduled. A run in progress finishes with its old settings. Changes to `store` and `schedule` take effect only after a restart. The agent logs which changes are waiting. If the new file is invalid, the agent logs the errors and keeps the old one.

## systemd

[contrib/systemd/goback-agent.service](https://github.com/gobackio/goback/blob/master/contrib/systemd/goback-agent.service) runs `/usr/local/bin/goback agent run --config /etc/goback/goback.yaml` as the user `goback`. systemd restarts the agent if it fails, and `systemctl reload` reloads its config:

```sh
sudo useradd --system --create-home --home-dir /var/lib/goback --shell /usr/sbin/nologin goback
sudo install -m 0755 goback /usr/local/bin/goback
sudo install -d -o goback -g goback -m 0700 /etc/goback /var/cache/goback
# write /etc/goback/goback.yaml and the files it names, readable by goback
sudo -u goback goback agent check --config /etc/goback/goback.yaml
sudo cp contrib/systemd/goback-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now goback-agent
```

- **Credentials.** Postgres passwords go in the `goback` user's `~/.pgpass`, MySQL's in the `defaults-extra-file`. Variables such as `GOOGLE_APPLICATION_CREDENTIALS` or `PGPASSFILE` go in a drop-in (`systemctl edit goback-agent`).
- **Stopping.** The unit gives the agent 60 seconds after SIGTERM (`TimeoutStopSec`), so keep `shutdown-grace` below that.

## Docker Compose

The [Postgres](/self-host/postgres/) and [MySQL](/self-host/mysql/) examples run the agent as a Compose service, with `goback agent status --check` as its health check.
