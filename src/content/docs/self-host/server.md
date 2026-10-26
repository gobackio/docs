---
title: Running a server
description: Serve one store to many agents over gRPC.
---

A goback server lets several agents back up to one store. It keeps the index and runs maintenance on its own schedule.

```sh
goback --storage gcs://my-bucket --index /var/lib/goback/index \
  server --address :6060 --secret-file secret --admin-key-file admin-key \
  --tls-cert cert.pem --tls-key key.pem
```

Agents use the server as their storage:

```sh
export GOBACK_STORAGE=goback://<secret>@backup.example.com:6060
goback --store-key store.key --agent-id laptop --set home commit new ~/
```

Each agent connects with the shared secret and its own `--agent-id`, which defaults to the hostname. Store keys stay on the agents, so names and contents reach the server already encrypted.

| Storage URL | Reaches |
| --- | --- |
| `goback://<secret>@host:port` | a server over TLS; port 443 when left out |
| `goback://host:port?key-file=/etc/goback/secret` | the same, reading the secret from a file |
| `goback://…?ca=ca.pem` | a server whose certificate is signed by the CA in `ca.pem` |
| `goback+insecure://<secret>@127.0.0.1:6060` | a server on this machine run with `--plaintext-behind-proxy`, without TLS |

| Flag | Does |
| --- | --- |
| `--address` | where it listens: `127.0.0.1:6060` by default, `:6060` for agents on other hosts |
| `--secret`, `--secret-file` | the secret agents present |
| `--admin-key`, `--admin-key-file`, `GOBACK_ADMIN_KEY` | the key admin commands present |
| `--tls-cert`, `--tls-key` | serve TLS |
| `--plaintext-behind-proxy` | serve without TLS behind a proxy that terminates it |
| `--retire-interval`, `--compact-interval`, `--gc-interval`, … | how often each maintenance step runs |

All flags: [`goback server`](/reference/cli/goback-server/).

Upgrade the server and its agents together. From v1.96.0 on, objects travel between them compressed, in the form the store keeps them, so agents and servers from before and after that release can't back up to each other.

## The admin key

The secret agents present backs up, reads and pins. It can also escrow the store key while the store keeps no copy of it, and change a set's retention to one that keeps at least as much. Everything else takes the admin key: deleting and undeleting commits and sets, unpinning, shortening retention, setting the trash window or the store policy, retiring, collecting, and escrowing another copy of the store key. So one machine's copy of the secret can't destroy another machine's backups.

Admin commands present the admin key in place of the secret:

```sh
goback --storage goback://<admin key>@backup.example.com:6060 set delete old-laptop
```

Without `--admin-key`, the server refuses these calls. Run them on the server's machine against the store and its index instead. The server won't start with an admin key that equals the secret.

## Failed keys and health

An address that presents a wrong key ten times is then held to one try every six seconds, and its calls fail before any key is checked. Behind a proxy, with `--plaintext-behind-proxy`, the address is the last `X-Forwarded-For` entry.

The server answers the gRPC health check, `grpc.health.v1.Health`. The service name `liveness` reports whether the process is up. Any other name reports readiness, which fails while the index doesn't answer and once the server starts shutting down.
