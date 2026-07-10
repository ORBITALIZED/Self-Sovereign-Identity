# 🧠 @ssi/service-ai-fraud

A Python microservice that scores incoming identity / credential / wrapped-badge events for fraud risk.

- **Framework**: FastAPI + Uvicorn
- **Model**: Gradient-boosted trees (XGBoost / scikit-learn) trained on labelled issuance patterns (issuer reputation, holder velocity, geo IP distance, biometric entropy, etc.).
- **Output**: probability ∈ [0.0, 1.0]

The service is _soft-fail_: if it's down, the relayer defaults to a permissive flag + manual review queue rather than blocking legitimate users.

## Endpoints

| Method | Path                  | Description                                                          |
| ------ | --------------------- | -------------------------------------------------------------------- |
| `GET`  | `/health`             | health probe                                                         |
| `POST` | `/score`              | score an `(issuer, holder, schema_hash, biometric_commitment)` tuple |
| `POST` | `/train`              | (admin only) re-train on the latest labelled dataset                 |
| `GET`  | `/explain?holder=0x…` | return top features for the last score                               |

## Setup

```bash
poetry install
poetry run uvicorn src.api:app --host 0.0.0.0 --port 8000
```

## ENV

| Var               | Purpose                               |
| ----------------- | ------------------------------------- |
| `MODEL_PATH`      | Path to the persisted `.joblib` model |
| `FRAUD_THRESHOLD` | Default cutoff used by the relayer    |
