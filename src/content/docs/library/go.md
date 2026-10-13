---
title: Go library
description: Open a store, back up, restore, schedule, maintain and serve from a Go program.
---

goback can also be used as a library.

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
| `AgentID`, `StoreKey`, `Passphrase`, `AtRestKey`, `CacheDir`, `MetadataCacheSize`, `BlobCacheSize` | as the [global flags](/reference/cli/) |
| `Logger` | |

| `repo.Key(ctx)` returns | When |
| --- | --- |
| the key in `StoreKey` | `StoreKey` is set |
| the escrowed key, opened with `Passphrase` | `Passphrase` is set |
| nil | the store is not encrypted |

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

| Job | Runs |
| --- | --- |
| `job.Path` | a path backup |
| `job.PostgresBase` | a Postgres base backup |
| `job.MySQLDump` | a MySQL dump |
| `job.PostgresReceive`, `job.MySQLReceive` | until their channel closes, then commit |

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

| Find a commit | |
| --- | --- |
| `backup.PickCommit(ctx, index, set, nil, t)` | the set's newest commit at or before `t` |
| `repo.LatestCommit(ctx, set)` | the set's newest commit, by name or id, also without an index |

| `TreeOptions` | |
| --- | --- |
| `From` | restore only this subtree |
| `Paths` | restore only these entries |
| `Name` | rename each restored entry |
| `Delete` | remove what the commit doesn't hold |
| `Listed`, `Written`, `Done`, `Removing` | progress callbacks |

Paths are slash-separated, relative to the set's directory.

Two entries next to the originals, renamed:

```go
err = restorer.RestoreTree(ctx, commit, "/home", backup.TreeOptions{
	Paths: []string{"projects/notes.md", "photos"},
	Name: func(path string, info os.FileInfo) string {
		return info.Name() + ".restored"
	},
})
```

One file, as of a time:

```go
node, outcome, err := restorer.RestorePath(ctx, repo.Index, "home", "projects/notes.md", time.Now(), "/tmp/notes.md")
```

| `Restorer` | |
| --- | --- |
| `Seeds`, `Cache`, `Workers`, `Overwrite`, `Verify`, `DryRun`, `Salvage`, `Rechunk` | as the flags of [`commit restore`](/reference/cli/goback-commit/#commit-restore) and [`file restore`](/reference/cli/goback-file/#file-restore); `Cache` from `repo.BlobCache` |
| `FS` | where files are written; nil is the local disk |
| `Stats()` | files written, unchanged and skipped; bytes by source |

### Restoring elsewhere

| `FS` implements | Restore |
| --- | --- |
| `backup.WriteFS` | writes each file front to back, up to 32 parts ahead |
| `backup.RandomWriteFS` | reuses existing data, resumes partial files, fetches in parallel |

`Symlink`, `Chmod` or `Chtimes` may return an error matching `errors.ErrUnsupported`; the restore skips them and counts skipped symlinks in `RestoreStats.Unsupported`.

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

| | |
| --- | --- |
| `cfg.Tasks()` | the tasks of an [agent config file](/self-host/agent/) |
| `a.Reload(tasks)` | replace the tasks of a running agent |
| `Task.Run` | a scheduled task, with a `Plan` from `agent.Every` or `agent.Cron` |
| `Task.Serve` | a task that runs all the time |

## Maintenance

```go
runner := maintenance.NewRunner(repo.Store, repo.Index, maintenance.DefaultSchedule)

ran, err := runner.Due(ctx) // once, as goback maintain does
// or
go runner.Run(ctx) // on the schedule, until ctx ends
```

`repo.Compact(ctx)` compacts only.

## Serve a store

As [`goback server`](/self-host/server/), until ctx ends:

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
