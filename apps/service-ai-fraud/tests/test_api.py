"""Smoke tests against the FastAPI app — /health and /score."""

from __future__ import annotations


def test_health_returns_model_name(client) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model"] in {"HeuristicDetector", "FraudDetector"}


def test_score_with_minimal_request(client) -> None:
    r = client.post("/score", json={"subject": "GABC"})
    assert r.status_code == 200
    body = r.json()
    assert 0.0 <= body["score"] <= 1.0
    # Heuristic detector always returns an explanation; FraudDetector
    # only does so when a model is loaded. Either way we should not 500.
    assert "explanation" in body


def test_score_with_full_request(client) -> None:
    r = client.post(
        "/score",
        json={
            "subject": "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            "issuer": "GISSUERABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
            "schema_hash": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            "biometric_commitment": "0x" + "11" * 32,
            "ip_country": "BR",
        },
    )
    assert r.status_code == 200
    assert 0.0 <= r.json()["score"] <= 1.0


def test_train_happy_path(client) -> None:
    """Train with valid labelled data and verify the response shape."""
    rows = [
        {
            "issuer_rep": 0.8,
            "schema_velocity": 0.0,
            "bio_entropy": 0.7,
            "ip_mismatch": 0.0,
            "time_since_last": 48.0,
            "cred_lifetime": 0.5,
            "duplicate_schema": 0.0,
            "label": 0,
        },
        {
            "issuer_rep": 0.3,
            "schema_velocity": 5.0,
            "bio_entropy": 0.2,
            "ip_mismatch": 1.0,
            "time_since_last": 0.5,
            "cred_lifetime": 0.01,
            "duplicate_schema": 1.0,
            "label": 1,
        },
        {
            "issuer_rep": 0.8,
            "schema_velocity": 1.0,
            "bio_entropy": 0.6,
            "ip_mismatch": 0.0,
            "time_since_last": 72.0,
            "cred_lifetime": 0.8,
            "duplicate_schema": 0.0,
            "label": 0,
        },
        {
            "issuer_rep": 0.3,
            "schema_velocity": 8.0,
            "bio_entropy": 0.1,
            "ip_mismatch": 1.0,
            "time_since_last": 0.1,
            "cred_lifetime": 0.005,
            "duplicate_schema": 1.0,
            "label": 1,
        },
    ]
    r = client.post("/train", json={"rows": rows})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "trained"
    assert body["samples"] == 4
    assert body["features"] == 7
    assert 0.0 <= body["accuracy"] <= 1.0


def test_train_empty_rows_rejected(client) -> None:
    """Training with no rows must return 400."""
    r = client.post("/train", json={"rows": []})
    assert r.status_code == 400
    assert "rows must not be empty" in r.json()["detail"]


def test_train_single_class_rejected(client) -> None:
    """Training with all identical labels must return 400."""
    rows = [
        {"issuer_rep": 0.8, "schema_velocity": 0.0, "bio_entropy": 0.7,
         "ip_mismatch": 0.0, "time_since_last": 24.0, "cred_lifetime": 0.5,
         "duplicate_schema": 0.0, "label": 0},
        {"issuer_rep": 0.7, "schema_velocity": 1.0, "bio_entropy": 0.6,
         "ip_mismatch": 0.0, "time_since_last": 48.0, "cred_lifetime": 0.6,
         "duplicate_schema": 0.0, "label": 0},
    ]
    r = client.post("/train", json={"rows": rows})
    assert r.status_code == 400
    assert "need both positive and negative examples" in r.json()["detail"]


def test_train_without_body_rejected(client) -> None:
    """Missing request body must return 422 (FastAPI validation)."""
    r = client.post("/train")
    assert r.status_code == 422


def test_train_defaults_missing_features_to_zero(client) -> None:
    """Rows with missing feature keys should default to 0.0 and train successfully."""
    rows = [
        {"issuer_rep": 0.5, "label": 0},
        {"issuer_rep": 0.2, "label": 1},
    ]
    r = client.post("/train", json={"rows": rows})
    assert r.status_code == 200
    assert r.json()["status"] == "trained"


def test_train_with_export(client, tmp_path) -> None:
    """Training with export=True should return exported path."""
    from unittest.mock import patch
    model_file = tmp_path / "fraud_v1.joblib"
    rows = [
        {"issuer_rep": 0.8, "schema_velocity": 0.0, "bio_entropy": 0.7,
         "ip_mismatch": 0.0, "time_since_last": 24.0, "cred_lifetime": 0.5,
         "duplicate_schema": 0.0, "label": 0},
        {"issuer_rep": 0.3, "schema_velocity": 5.0, "bio_entropy": 0.2,
         "ip_mismatch": 1.0, "time_since_last": 0.5, "cred_lifetime": 0.1,
         "duplicate_schema": 1.0, "label": 1},
    ]
    # MODEL_PATH is a module-level constant — patch it so export writes to tmp_path
    with patch("src.api.MODEL_PATH", model_file):
        r = client.post("/train", json={"rows": rows, "export": True})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "trained"
    assert "exported" in body
    assert model_file.exists()


def test_train_ignores_unknown_keys(client) -> None:
    """The training endpoint uses build_training_matrix which reads
    pre-computed feature keys (issuer_rep, schema_velocity, …). Unknown
    keys (e.g. raw payloads with issuer, subject) are silently ignored
    and their features default to 0.0 — training should still succeed."""
    rows = [
        {"issuer": "GABC", "subject": "GDEF", "schema_hash": "0xabc", "label": 0},
        {"issuer": "unknown", "subject": "GHIJ", "schema_hash": "0xdef", "label": 1},
    ]
    r = client.post("/train", json={"rows": rows})
    assert r.status_code == 200
    assert r.json()["status"] == "trained"
