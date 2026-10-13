---
title: Go library
description: Open a store, back up, restore, schedule, maintain and serve from a Go program.
---

:::caution
The API is not stable yet and may change between minor versions.
:::

```sh
go get github.com/gobackio/goback@latest
```

| Package | For |
| --- | --- |
| `goback` | opening and serving a store |
| `backup/job` | one backup run |
| `backup` | restores |
| `agent` | scheduled backups |
| `storage/maintenance` | housekeeping |

## Open a store

```go
repo, err := goback.Open(ctx, goback.Settings{
	Storage:  "gcs://my-bucket",
	Index:    "/var/lib/goback/index",
	StoreKey: "/etc/goback/store.key",
	CacheDir: "/var/cache/goback",
})
if err != nil {
	return err
}
defer repo.Close()
```

| `Settings` | |
| --- | --- |
| `Storage` | required |
| `Index` | required for a directory or bucket store |
| `AgentID`, `StoreKey`, `Passphrase`, `AtRestKey`, `CacheDir`, `MetadataCacheSize`, `BlobCacheSize` | the same settings as the [global flags](/reference/cli/) |
| `Logger` | where `Open` logs; nil means `slog.Default` |

`repo.Key(ctx)` returns the store key. It loads the key file in `StoreKey`, or opens the escrowed key with `Passphrase`. When neither is set, the store is not encrypted and the key is nil.

## Back up

```go
env, err := repo.Env(ctx, goback.Caches{Stats: true, Objects: true})
if err != nil {
	return err
}
defer env.Close() // before repo.Close

result, err := job.Path(ctx, env, job.PathSettings{Set: "home", Dir: "/home"})
if err != nil {
	return err
}
fmt.Printf("commit %x\n", result.Ref.GetHash())

job.AfterRun(ctx, env) // compact the store and trim the caches between runs
```

| `goback.Caches` | Effect |
| --- | --- |
| `Stats`, `Objects` | path backups skip unchanged files and trees |
| `Trees` | WAL and binlog receivers keep their commits and trees in memory |
| `Blobs` | restores read recently uploaded data locally |

`job.Path` runs a path backup, `job.PostgresBase` a Postgres base backup and `job.MySQLDump` a MySQL dump. `job.PostgresReceive` and `job.MySQLReceive` receive WAL or binlogs until their `stop` channel is closed, then make a last commit.

## Restore

```go
key, err := repo.Key(ctx)
if err != nil {
	return err
}

commit, err := backup.PickCommit(ctx, repo.Index, "home", nil, time.Now().Add(-24*time.Hour))
if err != nil {
	return err
}

restorer := &backup.Restorer{Store: repo.Store, Key: key}

err = restorer.RestoreTree(ctx, commit, "/srv/restored", backup.TreeOptions{})
```

`backup.PickCommit(ctx, index, set, nil, t)` finds the set's newest commit at or before `t`. `repo.LatestCommit(ctx, set)` finds the set's newest commit by name or id, and also works without an index.

| `TreeOptions` | |
| --- | --- |
| `From` | restore only this subtree |
| `Paths` | restore only these entries |
| `Name` | rename each restored entry |
| `Delete` | remove what the commit doesn't hold |
| `Listed`, `Written`, `Done`, `Removing` | progress callbacks |

Paths are slash-separated and relative to the set's directory.

This restores two entries next to the originals, under new names:

```go
err = restorer.RestoreTree(ctx, commit, "/home", backup.TreeOptions{
	Paths: []string{"projects/notes.md", "photos"},
	Name: func(path string, info os.FileInfo) string {
		return info.Name() + ".restored"
	},
})
```

This restores one file as it was at a given time:

```go
node, outcome, err := restorer.RestorePath(ctx, repo.Index, "home", "projects/notes.md", time.Now(), "/tmp/notes.md")
```

| `Restorer` | |
| --- | --- |
| `Seeds`, `Cache`, `Workers`, `Overwrite`, `Verify`, `DryRun`, `Salvage`, `Rechunk` | the same settings as the flags of [`commit restore`](/reference/cli/goback-commit/#commit-restore) and [`file restore`](/reference/cli/goback-file/#file-restore); get `Cache` from `repo.BlobCache` |
| `FS` | where files are written; nil is the local disk |
| `Stats()` | files written, unchanged and skipped; bytes by source |

### Restoring elsewhere

To restore somewhere other than the local disk, set `FS`. If it implements `backup.WriteFS`, the restore writes each file from front to back and fetches up to 32 parts ahead. If it implements `backup.RandomWriteFS`, the restore can also reuse data already in a file, resume partial files and fetch parts in parallel.

`Symlink`, `Chmod` and `Chtimes` may return an error matching `errors.ErrUnsupported`. The restore then skips that step, and counts skipped symlinks in `RestoreStats.Unsupported`.

## Run backups on schedules

```go
cfg, err := agent.Load("/etc/goback/goback.yaml")
if err != nil {
	return err
}

settings, err := cfg.Store.Settings()
if err != nil {
	return err
}

stateDir, err := cfg.StateDir(settings.CacheDir)
if err != nil {
	return err
}

a := &agent.Agent{
	Settings:    settings,
	Caches:      cfg.Store.Caches(),
	Concurrency: cfg.Schedule.Concurrency,
	Grace:       cfg.Schedule.ShutdownGrace,
	StateDir:    stateDir,
}

return a.Run(ctx, cfg.Tasks()) // until ctx ends
```

`cfg.Tasks()` returns the tasks of an [agent config file](/self-host/agent/). You can also build tasks yourself. A task with `Run` runs on a schedule, with a `Plan` from `agent.Every` or `agent.Cron`. A task with `Serve` runs all the time. `a.Reload(tasks)` replaces the tasks of a running agent.

## Maintenance

```go
runner := maintenance.NewRunner(repo.Store, repo.Index, maintenance.DefaultSchedule)

ran, err := runner.Due(ctx) // run what is due once, for example from cron
// or
go runner.Run(ctx) // run each job on its schedule until ctx ends
```

`repo.Compact(ctx)` only compacts the store.

## Serve a store

`repo.Serve` serves the store to agents until ctx ends. It also runs the maintenance jobs of its schedule. See [Running a server](/self-host/server/).

```go
listener, err := net.Listen("tcp", ":6060")
if err != nil {
	return err
}

return repo.Serve(ctx, listener, goback.ServeOptions{
	Secret:   secret,
	TLS:      tlsConfig, // or PlaintextBehindProxy: true behind a proxy that terminates TLS
	Schedule: maintenance.DefaultSchedule,
})
```
