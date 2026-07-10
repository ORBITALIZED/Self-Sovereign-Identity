# 📦 @ssi/zk-circuits

Zero-knowledge circuits powering the **Selective Disclosure** primitive of the platform.
Compiled with **Circom 2** and proven with **snarkjs** (Groth16).

| Circuit                   | What it proves                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `credential.circom`       | User holds a valid credential issued by one of an allow-listed set of issuers, _without revealing which credential_ |
| `age_verification.circom` | User is older than `minAge`, _without revealing their date of birth_                                                |

Public inputs:

- `issuer_merkle_root` — Merkle root of authorised issuer public keys
- `min_age` / `current_timestamp` — for age check
- `schema_hash` — credential schema the subject claims

Private inputs:

- `issuer_pk` — issuer public key (private to holder)
- `nullifier` — unique-per-presentation secret (prevents Sybil)
- `dob` — date of birth (kept private)
- `merkle_path` — Merkle inclusion proof against `issuer_merkle_root`

## Build & test

```bash
bash scripts/compile.sh          # produces ./build + ./keys
bash scripts/setup.sh            # powers-of-tau (development keys)
node test/credential.test.js     # proves a sample witness
```

## Output artifacts

```
build/
  credential.r1cs
  credential_js/credential.wasm
keys/
  credential_final.zkey
  verification_key.json
```
