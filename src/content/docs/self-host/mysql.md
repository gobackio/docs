---
title: MySQL
description: Dumps and the binary log, received as a replica, in two sets, restored to any second in between.
---

`goback mysql` streams `mysqldump` output into one set. It connects to the server as a replica and receives the binary log into another set. It can restore a server to a dump, or to any second after it that the binary log covers. It supports MySQL 5.5 to 8.4. The example below runs it with Docker Compose. The files are in [contrib/mysql](https://github.com/gobackio/goback/tree/master/contrib/mysql).

`compose.yaml` backs up a MySQL 8.0 container into a GCS bucket:

- The `agent` service runs [`goback agent run`](/self-host/agent/) with `goback.yaml`. Its one backup, `db`, runs `mysqldump` every day at 03:00 and stores the dump in the `db/dump` set. The agent runs from the `mysql:8.0` image because it needs `mysqldump`.
- The same agent connects to the server as a replica, receives its binlogs into a local spool, and commits them to the `db/binlog` set every minute. It only needs the MySQL port, not the data directory.
- The agent's container gets the goback binary from the `goback-bin` volume. A one-shot service copies the static binary into the volume on every `docker compose up`. To upgrade, run `docker compose build` and then `docker compose up -d`.
- The dump and the receiver read the password from the option file named by `defaults-extra-file`. The receiver keeps the password in memory only.

`goback.yaml`:

```yaml
store:
  storage: gcs://BUCKET
  index: /var/lib/goback/index
  store-key: /run/secrets/goback-key
  agent-id: db
  cache-dir: /var/lib/goback/cache

backups:
  - name: db
    mysql:
      defaults-extra-file: /run/secrets/mysql-client.cnf
```

The `agent` service in `compose.yaml`:

```yaml
agent:
  image: mysql:8.0
  depends_on:
    goback-bin:
      condition: service_completed_successfully
    mysql:
      condition: service_started
  restart: unless-stopped
  stop_grace_period: 40s
  user: mysql
  entrypoint: [/opt/goback/goback, agent, run]
  environment:
    GOBACK_CONFIG: /etc/goback/goback.yaml
    GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/gcp-credentials
  secrets:
    - goback-key
    - gcp-credentials
    - mysql-client.cnf
  volumes:
    - ./goback.yaml:/etc/goback/goback.yaml:ro
    - goback-bin:/opt/goback:ro
    - goback-agent:/var/lib/goback
  healthcheck:
    test: [CMD, /opt/goback/goback, agent, status, --check]
    interval: 1m
    timeout: 10s
    start_period: 2m
```

## Setup

1. Replace `BUCKET` in `goback.yaml` with your bucket.
2. Put a service account key with access to the bucket in `gcp-credentials.json`.
3. Create the store key with `goback key new <store name>` (it writes `store.key`) and move it to `goback.key`. Without it, your backups can't be restored.
4. Put the root password in `mysql-root-password`.
5. Pick a password for goback's user and put it in `mysql-client.cnf`. Make it readable by the agent's `mysql` user and writable by no one else; `mysql` ignores a world-writable option file:

   ```ini
   [client]
   host = mysql
   user = goback
   password = …
   ```

6. Start the server with `docker compose up -d mysql`, and create the user:

   ```sql
   CREATE USER 'goback'@'%' IDENTIFIED BY '…';
   GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES, PROCESS, RELOAD,
     REPLICATION CLIENT, REPLICATION SLAVE ON *.* TO 'goback'@'%';
   ```

7. Run `docker compose up -d`, then check the setup with `docker compose exec agent /opt/goback/goback agent check`. If `db/dump` holds no dump yet, the agent takes one right away. The receiver starts at the binlog position of the newest dump.

Details:

- **Dumps only.** With `pitr: false` under `mysql:`, the agent takes only the daily dumps. With `log_bin` on, a dump still records its binlog position, so a receiver started later can continue from it.
- **Point-in-time recovery window.** The agent keeps binlogs back to the oldest dump within `window` (14 days by default). The `db/dump` set's retention decides which dumps are kept.
- **Retention of the two sets.** Each `db/binlog` commit holds the whole window, so the set only needs its newest few commits: `goback set retention db/binlog --keep-last 60`. A retention by age would keep binlogs from long before the window. `db/dump` must keep every dump within the window, or recovery can't reach back as far: `goback set retention db/dump --keep-within 360h` covers the window plus a day.
- **Non-transactional tables.** A dump reads everything in one transaction. If user tables use another engine, such as MyISAM, the dump locks all tables until it finishes and logs which tables caused the lock.
- **The open binlog.** Each commit includes the binlog the server is still writing, so a restore reaches the last commit, not just the last rotation.
- **Commits.** The agent commits every minute (`commit-every`), or sooner once 256 MiB of new binlog has arrived (`commit-bytes`). It doesn't commit while the server writes nothing.
- **Server id.** The agent connects with a server id derived from the `db/binlog` set's name. If another replica already uses that id, receiving fails with an error. Set `server-id` to choose another.
- **Stopping.** On SIGTERM, the agent makes a last commit within its shutdown grace period (30 s). The service's `stop_grace_period` must be longer.
- **Gaps.** The server keeps binlogs only until they expire. If the server purges binlogs the agent hasn't received yet, for example while the agent is down, receiving fails until a newer dump exists.
- **Resets.** After `RESET MASTER`, or after the server is restored in place, the agent continues in a new chain within the same set. A restore only replays binlogs from the chain of the dump it picks. Dumping or receiving from a different server than the set's fails.
- **Spool.** The `goback-agent` volume holds the binlogs waiting to be committed, plus the agent's caches and status. Make it large enough for the binlogs written while the bucket is unreachable.
- **Status.** `docker compose exec agent /opt/goback/goback agent status` lists each job's last run. The container's health check fails when the agent hangs or a job falls behind.
- **Checking the server.** `goback agent check` lists anything the server is missing for receiving: `log_bin`, `server_id`, the privileges and a free server id.

## Database settings

| setting | dumps only | dumps + binlogs |
|---|---|---|
| `log_bin` | not needed | **on**. Needs a `my.cnf` change and a restart on 5.5–5.7. On by default from MySQL 8.0 |
| `server_id` | — | non-zero, and different from goback's. 5.5 logs with 0. 8.0 defaults to 1 |
| `binlog_format` | — | `ROW` advised, `MIXED` acceptable. 5.5 defaults to `STATEMENT`, 8.0 to `ROW` |
| binlog expiry | — | long enough to cover goback being down, such as 3 days or more. Nothing holds binlogs back for goback. `expire_logs_days` on 5.5–5.7; `binlog_expire_logs_seconds` from MySQL 8.0 (default 30 days); 8.4 removed `expire_logs_days` |
| `sync_binlog` | — | `1` advised, so a host crash can't drop transactions goback already received. 5.5 defaults to 0, MySQL from 5.7.7 to 1 |
| `binlog_encryption` (8.0.14+) | — | any: the server decrypts the stream |
| privileges | `SELECT`, `SHOW VIEW`, `TRIGGER`, `EVENT`, `LOCK TABLES`; `PROCESS` on MySQL 8.0.21+ | the dump's plus `REPLICATION SLAVE` (the binlog dump) and `REPLICATION CLIENT`. `RELOAD` for the dump's position |
| network | the MySQL port from wherever the agent runs | the same |

With `log_bin` on, the default on 8.0, a dump records its binlog position. It then needs `RELOAD` and `REPLICATION CLIENT`, even if no binlogs are received. `goback mysql dump --no-binlog-position` skips recording the position.

## Restore

`goback mysql restore` loads a dump into a running, empty server, then replays the binlog set on top of it:

- **Choosing the dump.** It picks the newest dump that ended before `--at` and whose chain the binlog set continues. Without `--at`, it picks the newest such dump.
- **Replaying.** It downloads the binlogs into `--work-dir` and replays them with a single `mysqlbinlog | mysql` pipeline, from the dump's position up to `--at`, to the second. The binlog that was still open at the last commit is replayed last, under its own name.
- **Without `--binlog-set`.** It loads only the dump. `--at` requires `--binlog-set`.
- **The target.** It refuses a server that already holds databases of its own; `--force` loads anyway. The target's `max_allowed_packet` must be at least as large as the source's.
- **`mysqlbinlog`.** It must be at least the source server's version. `--mysqlbinlog` sets which one to run. The `mysql:8.0` image doesn't include it. Then restore with `--to <dir>`, which writes the dump and the binlogs into an empty directory, and run the two commands it prints where `mysqlbinlog` is installed.
- **Finding the sets.** It looks the sets up in the index. If the index doesn't have them, as on a new host, it finds them in the bucket.

### Restoring next to a running server

Start a second MySQL and restore into it:

```sh
docker run -d --name mysql-restored -e MYSQL_ROOT_PASSWORD=… mysql:8.0
/opt/goback/goback --storage "gcs://BUCKET" \
  --index /var/lib/goback/index --store-key goback.key \
  mysql restore --defaults-extra-file restored.cnf \
  --dump-set db/dump --binlog-set db/binlog --at 2026-10-02T14:30:00Z
```

`restored.cnf` names the second server in its `[client]` section.

### Writing the files instead

```sh
goback --storage "gcs://BUCKET" --index /var/lib/goback/index --store-key goback.key \
  mysql restore --dump-set db/dump --binlog-set db/binlog --at 2026-10-02T14:30:00Z --to ./restore
```

The command prints one command that loads the dump and one that replays the binlogs. Run them in that order against the target server.
