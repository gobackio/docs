---
title: Encryption and keys
description: The store key that encrypts on the agent, escrow under a passphrase, and the at-rest key.
---

| Key | Encrypts | Where |
| --- | --- | --- |
| **store key** | names and contents, before they leave the agent | the agent; a server never sees it |
| **at-rest key** | archives, where a local, `gcs://` or `s3://` store keeps them | the store's host |

The two are independent.

## Store key

```sh
goback key new my-store        # writes store.key
goback key id                  # the id that names it in the store
```

Pass it with `--store-key store.key`. **Without the key or its passphrase, nothing can be restored.**

## Escrow

Wrap the key under a passphrase as an armored [age](https://age-encryption.org) file, and keep it with the store:

```sh
goback --storage gcs://my-bucket key escrow --key store.key --upload
```

An agent then opens it with `--passphrase` (or `GOBACK_PASSPHRASE`) instead of `--store-key`. Without `--upload` the escrowed key is printed; `age -d` also opens it.

Rebuild a key file from an escrowed copy:

```sh
goback key recover --escrow escrowed.age --out store.key
```

## At-rest key

```sh
goback key at-rest --out at-rest.key
goback key at-rest --out at-rest.key --rotate   # add a new primary; old keys still open what they sealed
```

Pass it with `--at-rest-key`. Without one, objects are stored as received.
