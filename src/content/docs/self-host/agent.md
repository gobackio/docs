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
| `passphrase-file` | `--passphrase-file`, `GOBACK_PASSPHRASE_FILE`; `--passphrase`, `GOBACK_PASSPHRASE` | a file holding the passphrase of the escrowed store key |
| `at-rest-key` | `--at-rest-key` | |
| `agent-id` | `--agent-id` | the hostname |
| `cache-dir` | `--cache-dir`, `GOBACK_CACHE_DIR` | |
| `metadata-cache-size` | `--metadata-cache-size` | `1GiB`; `0` for no bound |
| `blob-cache-size` | `--blob-cache-size` | `4GB`; `0` for no bound |
| `blob-cache-on-backup` | `--blob-cache-on-backup` | `true` |

The agent rejects a `goback://` storage URL in the file that contains the server's secret. Put the secret in a file and name it with `?key-file=`, for example `goback://backup.example.com?key-file=/etc/goback/secret`. The agent reads the file again whenever it changes, so a key you replace in place takes effect without a restart. While the file is briefly missing, it keeps the last key. A secret written into the URL takes a restart to change. See [Storage and index](/self-host/storage/) and [Encryption and keys](/self-host/keys/).

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
| `name` | required | unique, and not only digits, which name a set by its id. It names the backup's sets; slashes put them in [groups](/concepts/sets/), as in `srv1/db` |
| `every` | | run at each multiple of this interval since the Unix epoch, shifted by the jitter offset: `every: 1h` runs every hour at the same minute |
| `cron` | | five fields, or `@hourly`, `@daily`, `@weekly`, `@monthly`, in the system's time zone |
| `jitter` | `0` | shift every run by a fixed offset up to this long. The offset stays the same across restarts and differs per agent and backup |
| `timeout` | none | cancel a run after this long |
| `retention` | | the policy the path set, or the base or dump set, starts with when the backup's first run creates it, as `goback set retention` shows one: `"keep-last=1 keep=daily=30 keep=monthly"`. A set that exists keeps its own. Without it, a path set starts with none, and a base or dump set keeps one a day for 60 days, then one a week for 4 weeks. WAL and binlog sets start keeping their newest 60 commits |

Set `every` or `cron`, not both. A database backup without either runs every day at 03:00. A path backup without either runs once a day while it [watches for changes](#watching-for-changes); with `watch: off` it needs one of them. These keys schedule the full backups only. WAL and binlog receivers run all the time.

A backup that has never run, or that missed a run while the agent was down, runs its jitter offset after the agent starts, or at its next planned run if that comes sooner. Agents started together therefore start their backups apart. Without `jitter`, it runs right away. The agent takes a backup's last run from the newest complete commit in its set, so a manual `goback commit new` counts too. A failed run is retried after a minute. The wait doubles after each failure, up to an hour, but a retry comes no later than the next planned run.

| Kind | Sets |
| --- | --- |
| `path` | `<name>` |
| `postgres` | `<name>/base`, and `<name>/wal` with `pitr` |
| `mysql` | `<name>/dump`, and `<name>/binlog` with `pitr` |

Two backups can't write to the same set.

### path

These keys go under the backup's `path:`, as in the example above. They are the settings of [`goback commit new`](/reference/cli/goback-commit/#commit-new).

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
| `pre-hook`, `post-hook` | | shell commands run before the walk, and after it whether it succeeded or not. Their environment lacks `GOBACK_PASSPHRASE` and `GOBACK_ADMIN_KEY`, and `GOBACK_STORAGE` and `GOBACK_INDEX` when those hold a key or password |
| `hook-timeout` | `5m` | deadline of each hook |
| `hook-optional` | `false` | back up anyway when the pre hook fails |
| `vss` | `false` | on Windows, read `dir` from a shadow copy taken after the pre hook, so open files are read as they were at one moment. It needs an elevated administrator; otherwise the live files are read |
| `download-placeholders` | `false` | on Windows, read files OneDrive and other sync clients keep only in the cloud, which downloads them. Otherwise they're recorded without content, and a restore leaves them out. A file that went cloud-only after it was backed up, unchanged, keeps the content backed up before |
| `watch` | `auto` | follow `dir` for changes where the system allows it, so a run reads only what changed. `off` reads everything on every run |
| `min-gap` | `5m` | the least time from one run's start to a run that a change starts |
| `full-read-every` | `168h` | how often a watched backup reads everything anyway |

#### Watching for changes

With `watch: auto`, a run lists and reads only the directories something changed in since the set's last run. It takes the rest from the latest commit. A change starts a run once `min-gap` has passed since the last run started. `every` and `cron` still set the longest time between runs.

| System | Follows the directory with |
| --- | --- |
| Linux, as root with `CAP_SYS_ADMIN` and `CAP_DAC_READ_SEARCH`, kernel 5.9 or later | fanotify, one mark on the directory's filesystem |
| Linux otherwise, as in most containers | inotify, a watch on every directory |
| Windows, with the agent elevated | the NTFS change journal of the directory's volume |
| Windows without elevation, macOS and other systems | nothing: each run reads everything, on the backup's plan |

A run reads everything:

- on the first watched run of the set, and every `full-read-every`;
- when `include`, `exclude` or `download-placeholders` changed;
- when the set's latest commit isn't the one the last watched run made, as after a `goback commit new` by hand;
- when goback can't tell what changed: after the agent starts on Linux, after the event queue overflows, when the directory is moved, removed or unmounted, or when too many directories changed at once.

The change journal outlives the agent, so on Windows a run after a restart reads only what changed, including changes made while the agent was down. Subtrees inotify can't watch, as at the system's watch limit, are read on every run, and so are other filesystems mounted inside the directory. The agent keeps each set's position in `watch.json` in its state dir.

### postgres

These keys go under the backup's `postgres:`, as in the example above. They are the settings of [`goback postgres`](/reference/cli/goback-postgres/). The [Postgres page](/self-host/postgres/) lists the settings the cluster needs.

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

These keys go under the backup's `mysql:`, as in the example above. They are the settings of [`goback mysql`](/reference/cli/goback-mysql/). The [MySQL page](/self-host/mysql/) lists the settings the server needs.

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

A running agent writes `status.json` into its state dir at least once a minute. `goback agent status` prints it without contacting the store: each job's state, last start, result, last success, last dirty run, failures in a row, next due time, and in the `WATCH` column what follows a watched job's directory. Below the table it prints why the store last failed to open, why a job's last run couldn't be read, each job's last error, and for watched jobs why one isn't followed, which subtrees it reads on every run and why its last run read everything. `--json` prints the file as JSON.

A dirty run stores a commit but leaves out files that were torn or unreadable. It doesn't count as a success.

`goback agent status --check` is a health check. It exits 0 when healthy, 2 when there is no status to read, and 1 when:

- the agent stopped, or last wrote its status more than 3 minutes ago;
- a backup on `every` has not succeeded for three of its intervals, or one on `cron` since the third planned run after its last success. A backup that never succeeded counts from the agent's start. So does one whose last run the agent can't read, as while it can't open the store;
- a backup's last three runs or more were dirty;
- a receiver has not reported itself healthy for three times its `commit-every`.

## Schedule reports

The agent tells the store how often it plans a snapshot of each set: once the store is open, after every reload, and once a day. A backup on `every` expects one within its interval, and one on `cron` within the longest gap between two of its runs over the coming year, each plus its `jitter`. A WAL or binlog receiver reports its `commit-every`. A failed report is logged and sent again at the next reload or a day later.

A set is late once its expected gap, its jitter and a grace of half the gap, at least an hour, have passed since its newest snapshot, or since its agent first reported it. A WAL or binlog set is late only when its agent stops reporting. Every set of an agent is late once the agent is more than two days past its daily report. A report not renewed for 30 days expires, and its sets are no longer late.

`goback set list` shows the sets with what their agents expect and whether they are late. It reads the index, so run it against a directory or bucket store and its `--index`, such as on a server's machine:

```text
SET      STATE   EXPECTS              NEWEST               LATE
db/base  active  cron 24h0m0s         2026-10-26 03:00:41
db/wal   active  receiver every 1m0s  2026-10-26 12:14:02
home     active  every 1h0m0s +10m0s  2026-10-26 11:07:12
srv      active  cron 24h0m0s         2026-10-24 02:30:08  late
```

`NEWEST` is when the store received the set's newest live commit. With `--json`, each set has its `name`, `state`, `logical_size`, `newest` and `late`, and under `expected` the `kind`, `longest_gap_seconds`, `jitter_seconds` or `commit_every_seconds`, the reporting `agent`, `since` when it reports the set, and when it last `reported`.

goback cloud alerts on late sets; see [Late sets](/start/cloud/#late-sets).

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

:::caution
Mount the folder that holds the config, not the file itself: `./goback:/etc/goback:ro`. A file mount stays attached to the file the container started with. Most editors save by writing a new file and renaming it over the old one, so after an edit the container still sees the old version, and a reload changes nothing.
:::
