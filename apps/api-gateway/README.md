# 🔌 @ssi/api-gateway

The HTTP gateway the frontend (and third-party dApps) talk to. Backed by **Fastify** for low overhead and first-class TypeScript support.

## Endpoints

| Method | Path                    | Description                                                  |
| ------ | ----------------------- | ------------------------------------------------------------ |
| `GET`  | `/health`               | liveness + readiness                                         |
| `POST` | `/identity`             | Create identity (proxy to Soroban)                           |
| `GET`  | `/identity/:pubkey`     | Get an identity record                                       |
| `POST` | `/credentials`          | Issue a credential (requires issuer auth)                    |
| `GET`  | `/credentials/:subject` | List schemas a subject holds                                 |
| `POST` | `/zkp/prove`            | Generate a ZK proof from server-held circuit                 |
| `POST` | `/zkp/verify`           | Verify a ZK proof                                            |
| `GET`  | `/bridge/wrapped`       | List of recent **wrapped-badge** events (from Horizon + EVM) |
| `POST` | `/fraud/score`          | Score a synthetic profile for fraud risk                     |

## Setup

```bash
pnpm --filter @ssi/api-gateway dev     # ts-node + nodemon
docker compose up api-gateway
```

Open Swagger UI at `http://localhost:8080/docs`.
