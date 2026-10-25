---
title: Postgres
description: Base backups and streamed WAL into two sets, restored to any moment in between.
sidebar:
  badge: Beta
---

`goback postgres` takes base backups and streams the WAL, each into its own set. It can restore a cluster to any moment the two sets cover. The example below runs it with Docker Compose. The files are in [contrib/postgres](https://github.com/gobackio/goback/tree/master/contrib/postgres).

:::note
Postgres backups are in beta.
:::

`compose.yaml` backs up a Postgres container into a GCS bucket:

- The `agent` service runs [`goback agent run`](/self-host/agent/) with `goback.yaml`. Its one backup, `db`, takes a base backup into the `db/base` set every day at 03:00. On Postgres 15 and later, goback takes it over a replication connection. Older versions need `pg_basebackup`, which the goback image doesn't include.
- The same agent streams the WAL through a physical replication slot into a local spool, and commits it to the `db/wal` set every minute. It only needs the Postgres port, not the data directory.
- Restores run inside the Postgres container, which gets the goback binary from the `goback-bin` volume. A one-shot service copies the static binary into the volume on every `docker compose up`. To upgrade, run `docker compose build` and then `docker compose up -d`.

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
    postgres:
      dbname: host=postgres user=goback dbname=postgres
```

The `agent` service in `compose.yaml`:

```yaml
agent:
  image: goback
  depends_on:
    goback-bin:
      condition: service_completed_successfully
    postgres:
      condition: service_started
  restart: unless-stopped
  stop_grace_period: 40s
  command: [agent, run]
  environment:
    GOBACK_CONFIG: /etc/goback/goback.yaml
    GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/gcp-credentials
    PGPASSFILE: /run/secrets/goback.pgpass
  secrets:
    - goback-key
    - gcp-credentials
    - goback.pgpass
  volumes:
    - ./goback.yaml:/etc/goback/goback.yaml:ro
    - goback-agent:/var/lib/goback
  healthcheck:
    test: [CMD, /usr/bin/goback, agent, status, --check]
    interval: 1m
    timeout: 10s
    start_period: 2m
```

## Setup

1. Replace `BUCKET` in `goback.yaml` with your bucket.
2. Put a service account key with access to the bucket in `gcp-credentials.json`.
3. Create the store key with `goback key new <store name>` (it writes `store.key`) and move it to `goback.key`. Without it, your backups can't be restored.
4. Put the Postgres password in `postgres-password`.
5. Pick a password for the agent's role and put it in `goback.pgpass`:

   ```text
   postgres:5432:*:goback:…
   ```

6. Start the cluster with `docker compose up -d postgres`, and create the role:

   ```sql
   CREATE ROLE goback LOGIN REPLICATION PASSWORD '…';
   ```

7. Allow replication connections from the agent's container, and reload the configuration:

   ```sh
   docker compose exec -u postgres postgres sh -c '
     echo "host replication goback all scram-sha-256" >> "$PGDATA/pg_hba.conf" &&
     psql -c "SELECT pg_reload_conf()"'
   ```

   `all` in the database column doesn't match replication connections. The image's `host all all all` line covers the agent's normal connection to `postgres`.
8. Run `docker compose up -d`, then check the setup with `docker compose exec agent goback agent check`. It lists anything the cluster is missing: the version, the `REPLICATION` attribute, `max_slot_wal_keep_size`, a free slot and the `pg_hba.conf` lines.

Details:

- **Base backups only.** With `pitr: false` under `postgres:`, the agent takes only the daily base backups.
- **The first base backup.** If `db/base` holds no base backup when the agent starts, the agent takes one right away. Point-in-time recovery reaches back to it.
- **Point-in-time recovery window.** Recovery reaches at least `window` back (14 days by default): the agent keeps WAL from the newest base backup taken before the window starts. The `db/base` set's retention decides which base backups are kept.
- **Retention of the two sets.** The agent creates `db/base` keeping a base backup a day for 60 days, then one a week for 4 weeks. It creates `db/wal` keeping its newest 60 commits: each commit holds the whole window, so the newest few are enough. `retention:` on the backup, such as `retention: "keep-last=1 keep=daily=30"`, sets the policy `db/base` starts with instead. Both apply only when the agent creates the set; after that, `goback set retention` changes a set's policy. `db/base` must keep every base backup within the window and the one before it, or recovery can't reach back as far. A retention by age on `db/wal` would keep WAL from long before the window.
- **`max_slot_wal_keep_size`.** The slot holds every WAL file the agent hasn't committed yet, so `pg_wal` grows while the agent or the bucket is down. Past the cap, Postgres drops the slot's WAL. The agent then fills the gap from its spool, or reports it. The agent won't stream without a cap unless you set `allow-uncapped-slot: true`. Set the cap to what the database's disk can spare.
- **The open segment.** Each commit includes the segment Postgres is still writing, so a restore reaches the last commit, not just the last segment switch.
- **Commits.** The agent commits every minute (`commit-every`), or sooner once 256 MiB of new WAL has arrived (`commit-bytes`). It doesn't commit while the cluster writes nothing. Postgres can remove WAL held by the slot only after a commit holding it is stored.
- **Stopping.** On SIGTERM, the agent makes a last commit within its shutdown grace period (30 s). The service's `stop_grace_period` must be longer.
- **Removing the backup.** The slot, `goback_db_wal`, keeps holding WAL after the agent is gone. Drop it with `goback --set db/wal postgres receive --drop-slot`, with `--dbname` or the `PG*` variables naming the cluster.
- **Spool.** The `goback-agent` volume holds the WAL waiting to be committed, plus the agent's caches and status. Make it large enough for the WAL written while the bucket is unreachable.
- **WAL retention during a base backup.** The agent's slot holds the WAL a base backup needs. Without the slot, `wal_keep_size` must cover the WAL written while a base backup runs.
- **Tablespaces.** Clusters with extra tablespaces aren't supported. A base backup only includes the tablespace in the data directory.
- **Status.** `docker compose exec agent goback agent status` lists each job's last run. The container's health check fails when the agent hangs or a job falls behind.

## Database settings

| setting | base backups only | base backups + WAL |
|---|---|---|
| `wal_level` | `replica` (the default since 10) | `replica` (the default since 10) |
| `max_wal_senders` | one free for the base backup | one free for the WAL stream and one for a base backup. Default 10; restart to change |
| `max_replication_slots` | — | one free. Default 10; restart to change |
| `max_slot_wal_keep_size` | — | **set it**, see above. Default `-1`, unlimited |
| `wal_keep_size` | at least the WAL written during a base backup | not needed: the slot holds the base's WAL |
| role | `REPLICATION`, for the base backup | `CREATE ROLE goback LOGIN REPLICATION` |
| `pg_hba.conf` | a `host replication` line for the agent's address | a `host replication` line for the agent's address, and a line for a normal connection to `postgres` |
| credentials | `.pgpass` or `PGPASSFILE` | the same |

goback streams WAL from Postgres 14 to 18. Base backups alone work from 9.6 on.

## Restore

`goback postgres restore` writes a base backup into an empty data directory. It sets the directory up so that Postgres recovers from the WAL set when it starts:

- **Choosing the base.** It picks the newest base backup that ended before `--at` and that the WAL set continues from. Without `--at`, it picks the newest such base backup.
- **Fetching WAL.** It sets `restore_command` in `postgresql.auto.conf` (`recovery.conf` before Postgres 12). Postgres then runs `goback postgres wal-get` to fetch each WAL file it needs. That command uses the global flags you gave `restore`, so they must also work where Postgres runs. `--goback` sets another command to run instead.
- **Copying WAL instead.** With `--copy-wal`, it copies the WAL Postgres needs into `pg_wal` (`pg_xlog` before Postgres 10). Postgres then recovers without goback or access to the store.
- **Without `--wal-set`.** It restores only the newest base backup, and Postgres recovers to the end of that backup. `--at` requires `--wal-set`.
- **Finishing.** It writes `recovery.signal` (from Postgres 12 on). Postgres promotes once recovery reaches `--at`, or the end of the WAL set.
- **Finding the sets.** It looks the sets up in the index. If the index doesn't have them, as on a new host, it finds them in the bucket.

### Restoring next to a running cluster

Restore into an empty directory and start a second Postgres on it, on another port:

```sh
docker compose exec -u postgres postgres sh -c '
  /opt/goback/goback --storage "gcs://BUCKET" \
    --index /var/lib/goback/index --store-key /run/secrets/goback-key \
    postgres restore --base-set db/base --wal-set db/wal --at 2026-10-02T14:30:00Z /var/lib/goback/restored &&
  pg_ctl -D /var/lib/goback/restored -o "-p 5433" -l /var/lib/goback/restored.log start'
```
