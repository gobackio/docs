---
title: Storage
description: What a set takes up in a store, how shared data is counted, and what the By set card on goback cloud's Billing screen shows.
---

goback stores each file's content as chunks. A chunk that is already in the store isn't stored again, whichever set, snapshot or agent it came from. Chunks are compressed before they are stored.

So a set's size in the store is usually much smaller than the files it backs up, and it doesn't grow by the full size of each snapshot. A snapshot adds only the chunks the store didn't hold yet.

## Sizes

goback reports four sizes for a set:

| Size | What it is |
| --- | --- |
| **Logical** | the newest version of every file in the set, before deduplication and compression |
| **Stored** | what the set's data takes up in the store, deduplicated and compressed. Data shared with other sets counts once, for one of them |
| **On its own** | what the set would take up if it were the only set in the store |
| **Freed by deleting** | what of the set's data no other set holds |

The sizes come from the store's last garbage collection. The console shows when that was. A snapshot taken since then isn't in them yet.

## Shared data

When two sets hold the same chunks, the store keeps them once and counts them once. They count toward the set that was created first. The other set's **Stored** size leaves them out.

So a set's **Stored** size can be much smaller than the data it holds, because an older set carries part of it. Every byte counts toward exactly one set, so the sets' **Stored** sizes add up to what the organisation holds in the store.

## On its own

**On its own** is what the set would take up if no other set shared its data. When it is larger than **Stored**, another set shares the data and the older set carries it.

## Freed by deleting

**Freed by deleting** is the part of the set's data that no other set holds. Deleting the set frees this much. Data another set still holds stays in the store and moves to that set's **Stored** size.

The change shows after the next garbage collection.

## History

**History** compares two sizes. The first is every distinct file version the set's snapshots hold, each counted once, before compression. The second is the logical size: the newest version of every file. The difference is what older versions add.

A set whose files change often, or that keeps many old snapshots, has a history much larger than its logical size. [Retention](/concepts/retention/) decides how many old snapshots a set keeps.

## By set

On goback cloud, the **By set** card on the Billing screen splits the month's storage and egress by set.

| Column | What it is |
| --- | --- |
| **Stored** | the GB-months the set held this month: each day's **Stored** size, added up and divided by the days in the month |
| **Egress** | the GB read with API keys bound to the set |
| **Cost** | Stored and Egress at list price |
| **Share** | the row's part of the card's total |

The **Included** row takes off once what the plan includes. With it, the card adds up to the storage and egress lines of the invoice.

Egress counts toward the set the API key was bound to when it read. A key bound to a group, such as `games`, reads every set in it, so its egress shows on the group's row `games/…` rather than on one of its sets. Keys not bound to any set show on one **Not tied to a set** row, split by key. See [Sets](/concepts/sets/) for groups and bound keys.

Opening a set's row shows its **On its own**, **Freed by deleting** and **History** sizes, how many snapshots it keeps and which rule keeps them, and what a backup of it stored in the last 30 days.
