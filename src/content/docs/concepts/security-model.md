---
title: Security model
description: What goback encrypts, who can see what, what it detects, and the risks it accepts.
---

goback encrypts at three independent layers. The store key is optional.

| Layer | Held by | Protects against | Primitive |
| --- | --- | --- | --- |
| **Store key** | the agent (or you) | the bucket, the server and goback cloud reading names and contents | Tink AES-SIV (deterministic AEAD), Tink HMAC-SHA256 PRF |
| **At-rest key** | the server | someone reading the bucket without the server | Tink XChaCha20-Poly1305, one derived key per archive (HKDF-SHA256) |
| **TLS** | agent ↔ server | the network path | TLS; a self-hosted server requires 1.2 or later |

An agent run without `--store-key` or `--passphrase` uploads data unencrypted. An agent with a key seals names and contents. A store policy can require a key, but it can't turn sealing off.

When you self-host, the at-rest key is optional. goback cloud seals data at rest. Each store's at-rest key is wrapped by a cloud KMS key.

A self-hosted server won't start without TLS unless you tell it that a proxy terminates TLS. An agent won't send its secret without TLS unless the URL starts with `goback+insecure://`.

## What the store key hides

| Data | With a store key |
| --- | --- |
| file and directory names | sealed |
| owner user and group names | sealed |
| symlink targets | sealed |
| extended attribute names and the paths hard links point to | sealed |
| file contents (chunks) and extended attribute values | sealed, compressed first |
| small files (≤ 4 KiB, stored inline) | sealed |
| file size, mode, modification time, type, flags | **visible** |
| numeric uid and gid | **visible** |
| directory structure and entry counts | **visible** |
| chunk boundaries (each part's offset and length), and the holes of sparse files | **visible** |
| whether a chunk compressed | **visible** |
| name length (token = name + 16 bytes) | **visible** |
| snapshot time, set name, agent id (the hostname by default), labels, consistent/partial flags | **visible** |
| which store key sealed an object (key id) | **visible** |
| object counts, sizes, upload timing | **visible** |

Sealing is deterministic, which lets dedup work under one key. It also means that:

- the same name in the same directory gives the same token in every snapshot, so an observer can follow one entry across snapshots and see when its size or mtime changes;
- identical chunks, and identical small files, give identical ciphertext.

The at-rest layer seals each record's payload. With it, someone reading the bucket can't see commit fields or names. Record headers stay readable: ref, type, size, timestamp and key ids. The server's index holds set names, agent ids, paths (tokens when sealed), sizes and times. goback doesn't encrypt the index.

The agent's cache under `--cache-dir` holds the objects the agent uploaded and read, in their stored form. Names in it are sealed under the store key. Snapshot metadata, such as WAL file names, is not.

## Who can see what

### Self-hosted

| Party | Can see | Can do |
| --- | --- | --- |
| someone who reads the bucket | without an at-rest key: everything the agent sent (everything, if no store key). With one: headers, sizes, counts, timing. Escrowed key files in either case | guess the escrow passphrase offline |
| someone who writes to the bucket | as above | delete or corrupt archives; goback doesn't prevent this |
| any agent, or anyone with the server's shared secret | everything stored that is not sealed under the store key | back up, read and pin; fetch escrowed key files; escrow the store key while the store keeps no copy; change retention to keep at least as much |
| anyone with the server's admin key | as above | every API call, including deleting snapshots, shortening retention, requiring encryption through the store policy |
| whoever runs `goback server` | everything agents send that is not sealed under the store key; the at-rest key | withhold or roll back snapshots |
| whoever holds the store key | everything | restore anything |

All agents of a self-hosted server present the same secret, and admin commands present the [admin key](/self-host/server/#the-admin-key). Each caller declares its own agent id, and the server doesn't authenticate it.

### goback cloud

| Party | Can see | Can do |
| --- | --- | --- |
| someone who reads the bucket | headers, sizes, counts, timing, tenant ids in paths, escrowed key files, KEK-sealed held keys | guess escrow passphrases offline |
| goback (the service and its operators) | everything an org sends that is not sealed under its store key; with key hold, the store key itself | everything the service does, for any org |
| another org on the same store | not your sets or snapshots. Without a store key on your side: whether a given chunk exists in the store (see Dedup) | — |
| any of the org's agent API keys | the org's snapshot metadata | — |
| … with `write` or `read` | escrowed key files | — |
| … with `write` (the default) | — | upload, start snapshots |
| … with `read` | file contents (sealed if a store key was used) | restore |
| … with `delete` | — | delete snapshots, sets, pins |
| an API key bound to a set | writes only to that set and the sets under it (`<set>/…`, see [Sets](/concepts/sets/)). Reads by ref and fetches of escrowed key files are not limited to them | — |
| org member (console) | sets, snapshots, sizes, activity; names as stored (tokens unless the org uses key hold); escrowed key files, to unlock | read-only |
| org admin | as member | issue and revoke API keys, add escrowed copies, delete and pin snapshots, retention |
| org owner | as admin | key hold and drop, members, billing, delete sets |

In goback cloud, the agent id is only a label. The API key alone decides access.

### Key hold

An owner can give goback the org's store key. Listings then show real names to every member.

- The whole key file is uploaded. Its two keysets open names **and contents**. goback uses the key to decrypt names and symlink targets for listings.
- The key is kept in the bucket, sealed under the key-encryption key (KEK) and bound to the store, org and key id.
- Dropping the key deletes both the stored copy and the copy in memory.
- While goback holds the key, it can read everything sealed under it.

### Escrow

`goback key escrow` encrypts the key file with a passphrase into an age file (scrypt, with age's default work factor of 2^18). You can open the file with `age -d`.

- The escrowed copy is stored in the bucket without at-rest sealing.
- Self-hosted: anyone with the server secret can fetch it.
- goback cloud: API keys with `write` or `read` can fetch it, because agents run with `--passphrase` need it to back up. Console members fetch it to unlock. Activity records each fetch and who made it.
- Anyone who has the copy can guess the passphrase offline. goback requires a passphrase of at least 12 characters when it creates a copy. Existing copies aren't rechecked.

### Console unlock

The console decrypts names in the browser with a WebAssembly module.

- The key comes from a key file you supply, or from the escrowed copy. The console fetches that copy when you click Unlock and opens it with the passphrase you enter.
- **Keep on this browser** stores the key file in IndexedDB, sealed with AES-GCM under a non-extractable browser key. Scripts on the page can still use that browser key.
- The module decrypts names, symlink targets and paths. The console doesn't download file contents.
- goback serves the page and the module. When you unlock, you trust the code served at that moment: a changed page could read the key.

## Dedup

| | |
| --- | --- |
| chunk id with a store key | SHA-256 of the sealed chunk with its key id and compression: different under every key, and checkable by the store. Stores written before v1.96.0 hold chunks named by SHA-256 over HMAC-SHA256(key, chunk) until [resealed](/self-host/reseal/) |
| chunk id without a store key | SHA-256 of the chunk |
| scope with a store key | everything written under that key |
| scope without a store key | the whole store; in goback cloud, every keyless org on the same store |
| chunker | FastCDC, 16/64/256 KiB, not keyed |

This means that:

- Without a store key, anyone from any org who can upload to the store can test whether a chunk exists in it. That shows whether someone stored a known file.
- Chunk boundaries depend only on content. Chunk lengths are visible even with a store key, so someone with the metadata can match the sequence of lengths of a known file.
- By default, every agent receives presence filters (Bloom filters over chunk ids) for the whole store. In goback cloud, filters from other orgs come without their set name or snapshot.

## Integrity

| Check | Detects |
| --- | --- |
| AEAD on sealed chunks, small files and names | tampering with sealed data, wrong key |
| chunk re-hashed against its id on restore | a corrupt or swapped chunk |
| part length on restore | a truncated chunk |
| stored-bytes hash (SHA-256, unkeyed) | corruption at rest |
| `goback scrub` | corruption, broken archive chains; read-only |
| at-rest AEAD | tampering with sealed records, for the holder of the at-rest key |
| server recomputes ids of what it receives, sealed chunks included | an agent sending mislabeled objects |
| client re-hashes every snapshot, directory and file object a server returns against the id it asked for | a server substituting or altering metadata |

Not detected:

- **Rollback and withholding.** Snapshots are not signed with the store key. The server stamps their time and decides what "latest" is. A dishonest store can hide snapshots, serve an older one as latest, or offer a snapshot built from objects it already holds.
- **Deletion.** Anyone with write access to the bucket can delete its contents. The hosted bucket has no object lock and no provider soft delete. Only snapshots deleted through goback go to the trash first.
- **Unkeyed hashes.** Someone who can rewrite the bucket can rewrite a stored hash along with the data.

## Keys and recovery

| | Store key | At-rest key |
| --- | --- | --- |
| lost | data sealed under it cannot be restored, unless an escrowed copy and its passphrase survive | the archives it sealed cannot be read |
| rotation | not supported; a store keeps escrowed copies of one key | `goback key at-rest --rotate`; older keys keep opening, compaction re-seals. No rotation command in goback cloud |
| stored as | a cleartext JSON file, mode 0600 | self-hosted: a cleartext file on the server. goback cloud: sealed under a KMS key |

goback cloud can't recover your store key unless you use key hold. Even then, it has no API call that returns a held key.

## Design decisions

| Decision and its risk | What it gives you | How to avoid the risk |
| --- | --- | --- |
| encryption is opt-in: an agent without a store key uploads in the clear | backups work before any key is set up; store-wide dedup | always run agents with `--store-key` or `--passphrase` |
| metadata stays visible: sizes, times, modes, tree shape, set names, hostnames, labels | listings, retention, sizing and billing without the key | use neutral set names and `--agent-id`; self-host with an at-rest key against bucket readers |
| deterministic sealing shows equal names and equal content | dedup under one key; incremental backups | none inside goback |
| chunk lengths fingerprint known files | dedup across versions of a file | none inside goback |
| keyless orgs dedupe store-wide, which gives an existence test | storage savings | use a store key |
| escrowed copies can be guessed offline | key recovery and passphrase-only agents | use a long random passphrase, or keep the key file yourself and skip escrow |
| key hold gives goback the whole key | readable names for every member | don't hold; unlock per browser instead |
| the console runs code goback serves | names in the browser | don't unlock in the console; use the CLI |
| snapshots are not signed | the server can stamp, order and retain them | keep an independent copy you control |
| one shared secret per self-hosted server, no per-agent identity | simple setup | one server per trust boundary |

## Not covered

- a compromised agent machine: it holds the store key and its credentials;
- a dishonest server or operator hiding, rolling back or deleting snapshots;
- anyone with write access to the bucket deleting it;
- traffic analysis: timing, sizes and volume of uploads;
- escrow passphrases that are guessable despite the minimum length;
- served-code attacks on the console;
- data written before a store key was configured;
- the security of the identity provider, the cloud KMS and the object store themselves.
