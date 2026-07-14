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


def test_train_endpoint_returns_501(client) -> None:
    """Phase-2 training endpoint is intentionally unimplemented."""
    r = client.post("/train")
    assert r.status_code == 501
    assert "training pipeline" in r.json()["detail"]
