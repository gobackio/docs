---
title: Quick start, goback cloud
description: Create an organisation, issue an agent key, back up to store.goback.io.
---

## Sign up

Create an organisation at [cloud.goback.io](https://cloud.goback.io). Everyone you invite signs in with their own account.

## Keep a store key

On **Keys**, add an escrowed store key and choose a passphrase. Agents fetch the key from the store and open it with the passphrase, so your machines don't need a key file.

:::caution
goback cloud can't recover the passphrase. Without it, your backups can't be restored.
:::

## Issue an agent key

On **Keys**, issue an agent key. Copy it right away: it is shown only once.

## Back up

```sh
export GOBACK_STORAGE=goback://<agent key>@store.goback.io
export GOBACK_PASSPHRASE=<passphrase>
goback --set home commit new ~/
```

The set appears in the console after the first commit.

## Next

- [Restore](/start/restore/)
- [CLI reference](/reference/cli/)
