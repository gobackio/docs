---
title: Quick start, goback cloud
description: Create an organisation, issue an agent key, back up to store.goback.io.
---

## Sign up

Create an organisation at [cloud.goback.io](https://cloud.goback.io).

## Keep a store key

On **Keys**, add an escrowed store key and choose a passphrase. Agents open it with the passphrase.

:::caution
goback cloud can't recover the passphrase. Without it, your backups can't be restored.
:::

Without a store key, goback cloud encrypts your backups only at rest. That protects them in the bucket, but goback can still read them. See the [security model](/concepts/security-model/).

## Issue an agent key

On **Keys**, issue an agent key. It is shown only once.

## Back up

goback cloud needs goback v1.97.1 or later. Objects travel to it compressed, and older versions can't back up to it.

```sh
export GOBACK_STORAGE=goback://<agent key>@store.goback.io
export GOBACK_PASSPHRASE=<passphrase>
goback --set home commit new ~/
```

## Late sets

[The agent](/self-host/agent/#schedule-reports) reports how often it plans a snapshot of each set. The rule **A backup set goes late** on the Alerts screen is on from the start, and alerts when a set goes longer than that without one, or when its agent stops reporting. A schedule chosen on a set's **Snapshots expected** card replaces the agent's report.

## Next

- [Restore](/start/restore/)
- [CLI reference](/reference/cli/)
