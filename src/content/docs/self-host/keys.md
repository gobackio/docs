---
title: Encryption and keys
description: The store key that encrypts on the agent, escrow under a passphrase, and the at-rest key.
---

| Key | Encrypts | Where |
| --- | --- | --- |
| **store key** | names and contents, before they leave the agent | stays on the agent |
| **at-rest key** | archives, where a local, `gcs://` or `s3://` store keeps them | the store's host |

The two are independent.

## Store key

```sh
goback key new my-store        # writes store.key
goback key id                  # the id that names it in the store
```

Pass it with `--store-key store.key`. **Without the key, or its escrowed copy and passphrase, your backups can't be restored.**

## Escrow

To keep the key in the store, encrypt it with a passphrase. goback writes it as an armored [age](https://age-encryption.org) file:

```sh
export GOBACK_PASSPHRASE='…'
goback key escrow --key store.key --upload
```

`--upload` keeps the escrowed key in the store that `GOBACK_STORAGE` and `GOBACK_INDEX` name. Agents can then use `--passphrase` (or `GOBACK_PASSPHRASE`) instead of `--store-key`. Without `--upload`, the command prints the escrowed key instead of storing it. You can also open the file with `age -d`. The passphrase needs at least 12 characters.

To rebuild a key file from an escrowed copy, run:

```sh
goback key recover --escrow escrowed.age --out store.key
```

## At-rest key

```sh
goback key at-rest --out at-rest.key
goback key at-rest --out at-rest.key --rotate   # add a new primary; old keys still open what they sealed
```

Pass it with `--at-rest-key`. Without one, archives are stored as the agents sent them.
