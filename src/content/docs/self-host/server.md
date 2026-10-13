---
title: Running a server
description: Serve one store to many agents over gRPC.
---

A goback server lets several agents back up to one store. It keeps the index and runs maintenance on its own schedule.

```sh
goback --storage gcs://my-bucket --index /var/lib/goback/index \
  server --address :6060 --secret-file secret --tls-cert cert.pem --tls-key key.pem
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
| `--tls-cert`, `--tls-key` | serve TLS |
| `--plaintext-behind-proxy` | serve without TLS behind a proxy that terminates it |
| `--retire-interval`, `--compact-interval`, `--gc-interval`, … | how often each maintenance step runs |

All flags: [`goback server`](/reference/cli/goback-server/).
