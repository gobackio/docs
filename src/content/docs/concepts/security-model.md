---
title: Security model
description: What goback encrypts, who can see what, what it detects, and the risks it accepts.
---

goback has three layers. Each is separate, and the store key is optional.

| Layer | Held by | Protects against | Primitive |
| --- | --- | --- | --- |
| **Store key** | the agent (or you) | the bucket, the server and goback cloud reading names and contents | Tink AES-SIV (deterministic AEAD), Tink HMAC-SHA256 PRF |
| **At-rest key** | the server | someone reading the bucket without the server | Tink XChaCha20-Poly1305, one derived key per archive (HKDF-SHA256) |
| **TLS** | agent ↔ server | the network path | TLS; a self-hosted server requires 1.2 or later |

An agent run without `--store-key` or `--passphrase` uploads in the clear. An agent with a key always seals; the store policy can require a key but cannot turn sealing off. The at-rest key is optional when you self-host. goback cloud is deployed with at-rest sealing, each store's key wrapped by a cloud KMS key. A self-hosted server refuses to start without TLS unless told a proxy terminates it; the agent refuses to send its secret without TLS unless the URL is `goback+insecure://`.

## What the store key hides

| Data | With a store key |
| --- | --- |
| file and directory names | sealed |
| owner user and group names | sealed |
| symlink targets | sealed |
| file contents (chunks) | sealed, compressed first |
| small files (≤ 4 KiB, stored inline) | sealed |
| file size, mode, modification time, type | **visible** |
| directory structure and entry counts | **visible** |
| chunk boundaries (each part's offset and length) | **visible** |
| whether a chunk compressed | **visible** |
| name length (token = name + 16 bytes) | **visible** |
| snapshot time, set name, agent id (the hostname by default), labels, consistent/partial flags | **visible** |
| which store key sealed an object (key id) | **visible** |
| object counts, sizes, upload timing | **visible** |

Sealing is deterministic, which is what makes dedup work under one key. As a result:

- the same name in the same directory gives the same token in every snapshot, so an observer can follow one entry across snapshots and see when its size or mtime changes;
- identical chunks, and identical small files, give identical ciphertext.

The at-rest layer seals each record's payload, so with it a bucket reader no longer sees commit fields or names. Record headers stay readable: ref, type, size, timestamp and key ids. The server's index holds set names, agent ids, paths (tokens when sealed), sizes and times, and is not sealed by goback.

The agent's cache under `--cache-dir` holds the objects it uploaded and read, as stored: names sealed under the store key, snapshot metadata such as WAL file names in the clear.

## Who can see what

### Self-hosted

| Party | Can see | Can do |
| --- | --- | --- |
| reads the bucket | without an at-rest key: everything the agent sent (everything, if no store key). With one: headers, sizes, counts, timing. Escrowed key files in either case | offline guessing of the escrow passphrase |
| writes to the bucket | as above | delete or corrupt archives; nothing in goback prevents it |
| holds the server's shared secret (any agent) | everything stored that is not sealed under the store key | every API call, including deleting snapshots, requiring encryption through the store policy, fetching escrowed key files |
| runs `goback server` | everything agents send that is not sealed under the store key; the at-rest key | withhold or roll back snapshots |
| holds the store key | everything | restore anything |

Every caller of a self-hosted server presents the same secret. The agent id is declared by the caller and is not authenticated.

### goback cloud

| Party | Can see | Can do |
| --- | --- | --- |
| reads the bucket (e.g. leaked credentials) | headers, sizes, counts, timing, tenant ids in paths, escrowed key files, KEK-sealed held keys | offline guessing of escrow passphrases |
| goback (the service and its operators) | everything an org sends that is not sealed under its store key; with key hold, the store key itself | everything the service does, for any org |
| another org on the same store | not your sets or snapshots. Without a store key on your side: whether a given chunk exists in the store (see Dedup) | — |
| any agent API key of the org | the org's snapshot metadata | — |
| … with `write` or `read` | escrowed key files | — |
| … with `write` (the default) | — | upload, start snapshots |
| … with `read` | file contents (sealed if a store key was used) | restore |
| … with `delete` | — | delete snapshots, sets, pins |
| API key bound to a set | writes: only that set and the sets under it (`<set>/…`, see [Sets](/concepts/sets/)). Reads by ref and escrowed key files: not limited to them | — |
| org member (console) | sets, snapshots, sizes, activity; names as stored (tokens unless the org uses key hold); escrowed key files, to unlock | read-only |
| org admin | as member | issue and revoke API keys, add escrowed copies, delete and pin snapshots, retention |
| org owner | as admin | key hold and drop, members, billing, delete sets |

The agent id is a label in goback cloud; access is decided by the API key alone.

### Key hold

An owner can hand the org's store key to goback so listings show real names to every member.

- The whole key file is uploaded: both keysets, which open names **and contents**. goback's code uses it to open names and symlink targets for listings.
- It is kept in the bucket, sealed under the KEK and bound to store, org and key id.
- Dropping it deletes the stored copy and the in-memory one.
- While it is held, goback can read everything sealed under that key.

### Escrow

`goback key escrow` wraps the key file as an age file under a passphrase (scrypt, age's default work factor 2^18). `age -d` opens it.

- The copy is stored in the bucket, not at-rest sealed.
- Self-hosted: every holder of the server secret can fetch it.
- goback cloud: API keys with `write` or `read` can fetch it, since agents run with `--passphrase` need it to back up; console members fetch it to unlock, and each fetch is recorded in Activity with who made it.
- Anyone who has it can guess passphrases offline. goback's tools require at least 12 characters when they create one; copies made earlier are not rechecked.

### Console unlock

The console decrypts names in the browser with a WebAssembly module.

- The key comes from a key file you supply, or from an escrowed file the console fetches when you click Unlock, opened with the passphrase you enter.
- **Keep on this browser** stores the key file in IndexedDB, AES-GCM-sealed under a non-extractable browser key. Script on the page can still use that key.
- The module opens names, symlink targets and paths. The console does not download file contents.
- The page and the module are served by goback. Unlocking means trusting the code served at that moment: a changed page could read the key.

## Dedup

| | |
| --- | --- |
| chunk id with a store key | SHA-256 over HMAC-SHA256(key, chunk): different under every key |
| chunk id without a store key | SHA-256 of the chunk |
| scope with a store key | everything written under that key |
| scope without a store key | the whole store; in goback cloud, every keyless org on the same store |
| chunker | FastCDC, 16/64/256 KiB, not keyed |

Implications:

- Without a store key, anyone who can upload to the store can test whether a chunk exists in it, from any org. This confirms whether someone stored a known file.
- Chunk boundaries depend only on content and their lengths are visible, even with a store key. Someone with the metadata can match the length sequence of a known file.
- Presence filters (Bloom filters over chunk ids) of the whole store go to every agent by default. In goback cloud, other orgs' filters arrive without their set name or snapshot.

## Integrity

| Check | Detects |
| --- | --- |
| AEAD on sealed chunks, small files and names | tampering with sealed data, wrong key |
| chunk re-hashed against its id on restore | a corrupt or swapped chunk |
| part length on restore | a truncated chunk |
| stored-bytes hash (SHA-256, unkeyed) | corruption at rest |
| `goback scrub` | corruption, broken archive chains; read-only |
| at-rest AEAD | tampering with sealed records, for the holder of the at-rest key |
| server recomputes ids of what it receives | an agent sending mislabeled objects |
| client re-hashes every snapshot, directory and file object a server returns against the id it asked for | a server substituting or altering metadata |

Not detected:

- **Rollback and withholding.** Snapshots are not signed with the store key. The server stamps their time and decides what "latest" is. A dishonest store can hide snapshots, serve an older one as latest, or offer a snapshot built from objects it already holds.
- **Deletion.** Anyone with write access to the bucket can delete it. The hosted bucket has no object lock and no provider soft delete. Deleted snapshots go to a trash first only when deleted through goback.
- **Unkeyed hashes.** Someone who can rewrite the bucket can rewrite a stored hash with it.

## Keys and recovery

| | Store key | At-rest key |
| --- | --- | --- |
| lost | data sealed under it cannot be restored, unless an escrowed copy and its passphrase survive | the archives it sealed cannot be read |
| rotation | not supported; a store keeps escrowed copies of one key | `goback key at-rest --rotate`; older keys keep opening, compaction re-seals. No rotation command in goback cloud |
| stored as | a cleartext JSON file, mode 0600 | self-hosted: a cleartext file on the server. goback cloud: sealed under a KMS key |

goback cloud cannot restore your store key unless you use key hold, and it has no call that returns a held key.

## Design decisions

| Decision and its risk | What it buys | Avoid it |
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
