---
title: Retention
description: Which snapshots a set keeps, how often backups and the policy work together, and what keeping fewer snapshots saves.
---

A retention policy decides which of a set's snapshots the set keeps. A snapshot the policy no longer keeps is retired. Its data is freed once no kept snapshot or pin still holds it.

On goback cloud, policies have names and are managed on the Retention screen. A set follows the policy attached to it on its settings, or the organisation's default policy. Self-hosted, see [Retention and maintenance](/self-host/retention/).

## Brackets

A bracket keeps the last snapshot of each calendar hour, day, week, month or year, for a number of those periods. The brackets run back from today one after the other, newest first. For example:

| Bracket | Keeps |
| --- | --- |
| hourly × 336 | the last snapshot of each hour, for the last 336 hours |
| daily × 60 | the last snapshot of each day, for the 60 days before that |
| weekly × 12 | the last snapshot of each week, for 12 weeks before that |
| monthly | the last snapshot of each month, from then on |

The last bracket can leave out its count to keep its snapshots forever.

## Rules

A snapshot is kept when at least one rule keeps it. The console lists which rules keep each snapshot.

| Rule | Keeps |
| --- | --- |
| **latest** | the newest snapshot, always |
| **last** | the newest *n* snapshots |
| **within** | every snapshot younger than a duration |
| **hourly**, **daily**, **weekly**, **monthly**, **yearly** | the last snapshot of each period in that bracket |
| **pinned** | a pinned snapshot, whatever the policy says |

## How often and how long

How often a set gets a snapshot and its policy decide together what is kept. A bracket keeps one snapshot per period. When a set gets more snapshots than that, for example every 15 minutes under an hourly bracket, the others are kept only by **last** or **within**. Once those let them go, they are retired.

So backing up more often than the finest bracket gives you more recent restore points, but they don't last. The data they added is kept only as long as a later kept snapshot still holds it.

## Keeping fewer snapshots

The By set card on the Billing screen can suggest a policy that keeps fewer snapshots of a set. Its figure is the most the change could save: what the backups behind the snapshots it would retire stored, at list price.

The real saving is often lower. A retired snapshot frees only the data no kept snapshot still holds. Data that a later snapshot reuses stays. The next garbage collection after the change shows the real figure in the set's **Stored** size. See [Storage](/concepts/storage/).

## Pulling less often

For a pull source that is pulled more often than its set's policy keeps, the card can suggest pulling less often. Its figure is the most the change could save: what the pulls behind snapshots kept only by **last** or **within** stored, at list price.

As with fewer snapshots, the real saving is often lower. When a source's data is only ever added to, pulling less often saves nothing, because every pull's new data is still held by the next snapshot.

The suggestion covers pull sources only. An agent's schedule is set where the agent runs.
