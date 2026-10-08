---
title: Quick start, goback cloud
description: Sign up, issue an agent key, and back up a machine to store.goback.io.
---

## Sign up

Create an organisation at [app.goback.io](https://app.goback.io). Everyone you invite signs in with their own account.

## Keep a store key

On **Keys**, add an escrowed store key and choose a passphrase. Agents fetch the key from the store and open it with the passphrase, so a machine never needs a key file.

:::caution
We cannot recover the passphrase. Without it, nothing can be restored.
:::

## Issue an agent key

On **Keys**, issue an agent key. It is shown once.

## Back up

```sh
export GOBACK_STORAGE=goback://<agent key>@store.goback.io:6060
export GOBACK_PASSPHRASE=<passphrase>
goback --set home commit new ~/
```

The set appears in the console after the first commit.

## Next

- [Restore](/start/restore/)
- [CLI reference](/reference/cli/)
