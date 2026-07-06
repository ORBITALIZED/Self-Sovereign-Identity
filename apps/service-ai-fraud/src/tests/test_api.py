from fastapi.testclient import TestClient
from src.api import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_score_deterministic_with_heuristic():
    r = client.post("/score", json={"subject": "0xabc", "issuer": "G…"})
    assert r.status_code == 200
    body = r.json()
    assert 0.0 <= body["score"] <= 1.0


def test_score_with_full_payload():
    r = client.post("/score", json={
        "subject":  "0xabc",
        "issuer":   "0xdef",
        "schema_hash": "0x" + "00" * 32,
        "biometric_commitment": "0x" + "11" * 32,
        "ip_country": "US",
    })
    assert r.status_code == 200
