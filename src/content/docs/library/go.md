---
title: Go library
description: Open a store, back up, restore, schedule, maintain and serve from a Go program.
---

Everything the CLI does, a Go program can do with these packages.

:::caution
The API is not stable yet and may change between minor versions.
:::

```sh
go get github.com/gobackio/goback@latest
```

| Package | Use it to |
| --- | --- |
| `goback` | open a store from the settings the CLI takes, and serve it |
| `backup/job` | run each kind of backup once |
| `backup` | restore commits, subtrees and files |
| `agent` | run backups on their schedules |
| `storage/maintenance` | run the housekeeping |

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

`Settings` takes what the [global flags](/reference/cli/) do: `Storage`, `Index`, `AgentID`, `StoreKey`, `Passphrase`, `AtRestKey`, `CacheDir`, `MetadataCacheSize` and `BlobCacheSize`, and a `Logger`. `Storage` is required, and `Index` for a directory or bucket store.

`repo.Key(ctx)` is the store key: read from `StoreKey`, else opened with `Passphrase` from the copy the store keeps escrowed, else nil for a store written in the clear.

## Back up

`repo.Env` opens what backups share: the store, the index, the key and the caches you ask for under `CacheDir`. Close it before the repo.

```go
env, err := repo.Env(ctx, goback.Caches{Stats: true, Objects: true})
if err != nil {
	return err
}
defer env.Close()

result, err := job.Path(ctx, env, job.PathSettings{Set: "home", Dir: "/home"})
if err != nil {
	return err
}
fmt.Printf("commit %x\n", result.Ref.GetHash())

job.AfterRun(ctx, env) // compact the store and trim the caches between runs
```

| `goback.Caches` | Lets |
| --- | --- |
| `Stats`, `Objects` | a path backup skip unchanged files and trees |
| `Trees` | a WAL or binlog receiver keep the commits and trees it reads every commit |
| `Blobs` | restores read what a path backup uploaded without downloading it |

`job.PostgresBase` and `job.MySQLDump` take the other full backups. `job.PostgresReceive` and `job.MySQLReceive` stream logs until the channel they are given closes, then make a last commit.

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

`PickCommit` with a nil ref picks the set's newest commit at or before a time. `repo.LatestCommit(ctx, set)` finds the newest one by name or numeric set id, from the set heads in the bucket when the index has none.

| `TreeOptions` | Restores |
| --- | --- |
| `From` | only the subtree at this path of the commit |
| `Paths` | only these files or directories, each at its own path under the directory |
| `Name` | each entry `Paths` names, or each top entry, under the name it returns |
| `Delete` | and removes what the commit doesn't hold |
| `Listed`, `Written`, `Done`, `Removing` | and reports its progress to these callbacks |

Paths are slash-separated and relative to the directory the set backs up. To restore two entries next to the originals under new names:

```go
err = restorer.RestoreTree(ctx, commit, "/home", backup.TreeOptions{
	Paths: []string{"projects/notes.md", "photos"},
	Name: func(path string, info os.FileInfo) string {
		return info.Name() + ".restored"
	},
})
```

One file, as the set held it at a time, with the directories above the destination made:

```go
node, outcome, err := restorer.RestorePath(ctx, repo.Index, "home", "projects/notes.md", time.Now(), "/tmp/notes.md")
```

`restorer.Stats()` counts files written, unchanged and skipped, and the bytes taken from the destination, seeds, cache and store. The `Restorer`'s other fields match the flags of [`commit restore`](/reference/cli/goback-commit/#commit-restore) and [`file restore`](/reference/cli/goback-file/#file-restore): `Seeds`, `Cache` (from `repo.BlobCache`), `Workers`, `Overwrite`, `Verify`, `DryRun`, `Salvage` and `Rechunk`.

### Restoring elsewhere

`Restorer.FS` is the file tree a restore writes, a `backup.WriteFS`; nil is the local disk, `backup.LocalFS`.

- **`WriteFS`** writes each file front to back. A restore streams it in order, with up to 32 parts fetched ahead.
- **`RandomWriteFS`** also opens files to read and write at offsets. A restore then takes parts from the file already there, resumes a partial file and fetches a file's parts in parallel.

A tree that can't hold symlinks, modes or times returns an error matching `errors.ErrUnsupported` from `Symlink`, `Chmod` or `Chtimes`, and the restore goes on without them; `RestoreStats.Unsupported` counts the symlinks left out.

## Run backups on schedules

`agent.Agent` runs tasks on their plans against one store it opens and keeps open. The tasks of an [agent config file](/self-host/agent/) come from `Config.Tasks`:

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

`a.Reload(tasks)` swaps the tasks of a running agent. A `Task` built by hand sets `Run` with a `Plan` from `agent.Every` or `agent.Cron`, or `Serve` for one that runs all the time.

## Maintenance

```go
runner := maintenance.NewRunner(repo.Store, repo.Index, maintenance.DefaultSchedule)

ran, err := runner.Due(ctx) // once, as goback maintain does
// or
go runner.Run(ctx) // on the schedule, until ctx ends
```

The runner finds the jobs a store supports from what it implements. `repo.Compact(ctx)` compacts alone.

## Serve a store

`repo.Serve` serves the store to agents over gRPC as [`goback server`](/self-host/server/) does, with health checks, the Admin service and the maintenance jobs of `Schedule`, until ctx ends:

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
