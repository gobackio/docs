---
title: Telemetry
description: The OpenTelemetry metrics and traces the agent and the server export.
---

`goback agent run` and `goback server` export OpenTelemetry metrics and traces once the standard `OTEL_*` environment variables name an exporter or an OTLP endpoint. Without them, they export nothing and contact no collector.

```sh
export OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318
goback agent run --config /etc/goback/goback.yaml
```

| Variable | Does |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | exports metrics and traces to this OTLP endpoint |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | exports only that signal |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf`, the default, or `grpc` |
| `OTEL_METRICS_EXPORTER=prometheus` | serves the metrics at `/metrics` on `OTEL_EXPORTER_PROMETHEUS_HOST` and `OTEL_EXPORTER_PROMETHEUS_PORT`, `localhost:9464` by default |
| `OTEL_METRICS_EXPORTER=console`, `OTEL_TRACES_EXPORTER=console` | writes that signal to standard output |
| `OTEL_TRACES_SAMPLER` | picks which traces are sampled |
| `OTEL_SERVICE_NAME` | replaces the service name, `goback` for the server and `goback-agent` for the agent |

The Prometheus exporter writes names with underscores and unit and `_total` suffixes, so `goback.schedule.runs` becomes `goback_schedule_runs_total`.

Each process reports the work it does. The server reports its store and index. An agent that backs up through a server reports its runs. An agent that backs up straight to a bucket reports the store and index as well. Both also report Go runtime metrics, and the server reports OpenTelemetry's standard gRPC server metrics. Traces cover the server's gRPC calls and the store's and index's operations.

## Backup runs

The agent reports these for each job, under the backup's `name` in the `job` attribute.

| Metric | Attributes | Records |
| --- | --- | --- |
| `goback.schedule.runs` | `job`, `result` | runs, by `result`: `ok`, `dirty`, `failed` or `cancelled` |
| `goback.schedule.run` | `job` | how long each run took, in seconds |
| `goback.schedule.last_success_timestamp` | `job` | when the last clean run started, in Unix seconds |
| `goback.schedule.last_dirty_timestamp` | `job` | when the last dirty run started, in Unix seconds; a dirty run left out torn or unreadable files |
| `goback.watch.following` | `job`, `backend` | 1 while a watched job's directory is followed for changes, else 0 |
| `goback.watch.unwatched` | `job` | subtrees of a watched job's directory that can't be followed and are read on every run |
| `goback.watch.runs` | `job`, `read` | watched runs, by `read`: `changed` when the run read only what changed, else why it read everything: `first`, `settings-changed`, `full-read-due`, `other-commit`, `in-doubt` or `not-following` |

To alert on a backup that stopped succeeding, compare `goback.schedule.last_success_timestamp` with the current time. [Watching for changes](/self-host/agent/#watching-for-changes) lists when a watched run reads everything.

## Store

| Metric | Attributes | Records |
| --- | --- | --- |
| `goback.storage.bucket.requests` | `operation` | requests to the bucket, by `operation`: `get`, `head`, `put`, `list`, `delete` or `copy`; failed requests count too |
| `goback.storage.bucket.bytes` | `operation` | bytes those requests carried |
| `goback.storage.pack.has.asked` | `caller` | refs the store was asked whether it holds, by `caller`: `missing` for a client asking which refs the store lacks, `assumed` for an upload checking the refs its client assumed the store holds, `references` for an upload checking what its object references, `other` for the rest |
| `goback.storage.pack.has.held` | `caller` | refs among those that the store holds |
| `goback.storage.pack.get_object_size`, `goback.storage.pack.put_object_size` | `object_type` | size of each object read or stored, in bytes |
| `goback.storage.pack.archive_read_size`, `goback.storage.pack.archive_write_size` | `object_type` | size of each archive read or write, in bytes |
| `goback.storage.pack.archive_read_latency`, `goback.storage.pack.archive_write_latency` | `object_type` | how long each archive read or write took, in milliseconds |
| `goback.storage.pack.gc.mark_duration`, `goback.storage.pack.gc.merge_duration`, `goback.storage.pack.gc.sweep_duration` | | how long each phase of a collection took, in seconds |
| `goback.storage.pack.gc.dead_bytes` | | bytes the last generation found unreachable |
| `goback.storage.pack.gc.reclaimed_bytes` | | bytes collections dropped |
| `goback.storage.pack.rewrite.archives` | | archives a sweep or compaction rewrote |
| `goback.storage.pack.rewrite.copied_bytes` | | bytes a sweep or compaction copied into new archives |
| `goback.storage.pack.rewrite.archive_duration` | | how long rewriting each archive took, in seconds |

`has.held` divided by `has.asked` is the share of lookups that found the object already stored. The `has` counters exist from v1.123.0, and carry `caller` from v1.123.4. See [Garbage collection](/internals/garbage-collection/) for the phases of a collection.

## Index

| Metric | Attributes | Records |
| --- | --- | --- |
| `goback.index.sql.lookup_duration` | `lookup` | how long finding which archives hold objects took, in milliseconds, by `lookup`: `object`, `copies`, `tombstones` or `claims` |

## Restores

Neither the agent nor the server restores. A program that restores through the [Go library](/library/go/) reports these once it installs an OpenTelemetry meter provider:

| Metric | Attributes | Records |
| --- | --- | --- |
| `goback.backup.restore.bytes` | `source` | bytes of restored files, by `source`: `store` or `cache` |
| `goback.backup.restore.files` | `outcome` | restored files, by `outcome`, such as `written`, `unchanged`, `skipped` or `lost` |
