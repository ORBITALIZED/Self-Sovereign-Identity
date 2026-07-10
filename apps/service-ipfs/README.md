# 📦 @ssi/service-ipfs

Encrypts and pins off-chain data (**biometric templates, encrypted profiles, credential documents**) to **IPFS** via [Helia](https://github.com/ipfs/helia) — the modern, modular IPFS implementation in JS.

- **Encryption**: AES-GCM with a key derived from a wallet signature (scrypt/pass-through).
- **Pluggable backend**: local Helia node by default; can swap for Pinata / Filecoin / Arweave.
- **API**: RESTful HTTP (Fastify prefix-agnostic).

## Endpoints

| Method | Path        | Description                                              |
| ------ | ----------- | -------------------------------------------------------- |
| `GET`  | `/health`   | health probe                                             |
| `POST` | `/pin`      | `{ payload: base64, encryptionKey: base64 }` → `{ cid }` |
| `GET`  | `/cid/:cid` | returns the raw (or decrypted) bytes                     |
| `POST` | `/unpin`    | admin-only: garbage-collect a CID                        |

## Run

```bash
pnpm --filter @ssi/service-ipfs dev
docker compose up service-ipfs
```

## Env

```
IPFS_API_URL=http://localhost:5001
ENCRYPTION_KEY=base64-of-32-bytes
```
