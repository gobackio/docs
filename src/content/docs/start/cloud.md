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

## Issue an agent key

On **Keys**, issue an agent key. It is shown only once.

## Back up

```sh
export GOBACK_STORAGE=goback://<agent key>@store.goback.io
export GOBACK_PASSPHRASE=<passphrase>
goback --set home commit new ~/
```

## Next

- [Restore](/start/restore/)
- [CLI reference](/reference/cli/)
