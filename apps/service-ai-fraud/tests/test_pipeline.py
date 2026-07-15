"""Integration tests for the training data pipeline.

Tests cover:
  - /feedback                  label a scored event
  - /events / /events/count    list / count stored events
  - /train/from-store          retrain from stored labelled events
  - /models / /models/activate model registry and activation

These tests require the event store and model registry to be initialised.
The conftest fixture patches config paths so all files go to tmp_path.
"""

from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

import src.api as ssi_api


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """FastAPI TestClient bound to the real app instance.

    Uses the context manager so that ``@app.on_event("startup")`` fires
    and initialises the event store and model registry globals.
    """
    with TestClient(ssi_api.app) as c:
        yield c


@pytest.fixture(autouse=True)
def _clean_event_store() -> None:
    """Clear the shared event store between tests."""
    store = getattr(ssi_api, "event_store", None)
    if store is not None:
        store.clear()


class TestFeedback:
    def test_feedback_requires_valid_value(self, client: TestClient) -> None:
        r = client.post("/feedback", json={"event_id": "x", "feedback": 42})
        assert r.status_code == 422

    def test_feedback_nonexistent_event(self, client: TestClient) -> None:
        r = client.post("/feedback", json={"event_id": "nonexistent", "feedback": 1})
        assert r.status_code == 404

    def test_feedback_happy_path(self, client: TestClient) -> None:
        # Score first to create an event in the store
        score_r = client.post("/score", json={"subject": "GABC"})
        assert score_r.status_code == 200
        event_id = score_r.json()["event_id"]
        assert event_id is not None

        r = client.post("/feedback", json={"event_id": event_id, "feedback": 1})
        assert r.status_code == 200
        assert r.json()["status"] == "labelled"

    def test_feedback_then_count(self, client: TestClient) -> None:
        sr = client.post("/score", json={"subject": "GX"})
        eid = sr.json()["event_id"]
        client.post("/feedback", json={"event_id": eid, "feedback": 0})

        cr = client.get("/events/count")
        assert cr.json()["labelled"] == 1
        assert cr.json()["unlabelled"] == 0


class TestEvents:
    def test_list_events_returns_empty(self, client: TestClient) -> None:
        r = client.get("/events")
        assert r.status_code == 200
        assert r.json()["events"] == []
        assert r.json()["total"] == 0

    def test_list_events_after_score(self, client: TestClient) -> None:
        client.post("/score", json={"subject": "GA"})
        client.post("/score", json={"subject": "GB"})
        r = client.get("/events")
        assert r.status_code == 200
        assert r.json()["total"] == 2
        assert len(r.json()["events"]) == 2

    def test_list_labelled_only(self, client: TestClient) -> None:
        sr = client.post("/score", json={"subject": "GA"})
        eid = sr.json()["event_id"]
        client.post("/score", json={"subject": "GB"})
        client.post("/feedback", json={"event_id": eid, "feedback": 1})

        r = client.get("/events", params={"labelled_only": True})
        assert len(r.json()["events"]) == 1

    def test_list_pagination(self, client: TestClient) -> None:
        for i in range(10):
            client.post("/score", json={"subject": f"G{i}"})
        r = client.get("/events", params={"limit": 3, "offset": 2})
        assert len(r.json()["events"]) == 3
        assert r.json()["total"] == 10

    def test_count_endpoint(self, client: TestClient) -> None:
        assert client.get("/events/count").json()["total"] == 0
        client.post("/score", json={"subject": "GA"})
        assert client.get("/events/count").json()["total"] == 1


class TestModels:
    def test_list_models_empty(self, client: TestClient) -> None:
        r = client.get("/models")
        assert r.status_code == 200
        assert r.json()["models"] == []
        assert r.json()["active"] is None

    def test_activate_nonexistent_model(self, client: TestClient) -> None:
        r = client.post("/models/activate", json={"name": "nonexistent"})
        assert r.status_code == 404


class TestTrainFromStore:
    def test_train_from_store_requires_labelled_events(self, client: TestClient) -> None:
        r = client.post(
            "/train/from-store",
            json={"model_name": "test_v1", "min_samples": 1, "min_classes": 1},
        )
        assert r.status_code == 400
        assert "labelled events" in r.json()["detail"]

    def test_train_from_store_happy_path(self, client: TestClient) -> None:
        """Score 4 events with varied payloads, label them, and retrain."""
        payloads = [
            {
                "subject": "GX",
                "issuer": "G" + "A" * 55,
                "schema_hash": "0xabc",
                "ip_country": "US",
            },
            {
                "subject": "GY",
                "issuer": "G" + "B" * 55,
                "schema_hash": "0xdef",
                "ip_country": "BR",
            },
            {
                "subject": "GZ",
                "issuer": "G" + "C" * 55,
                "schema_hash": "0xabc",
                "ip_country": "US",
            },
            {
                "subject": "GW",
                "issuer": "0x" + "d" * 40,
                "schema_hash": "0xdef",
                "ip_country": "CN",
            },
        ]
        labels = [0, 1, 0, 1]

        event_ids = []
        for p in payloads:
            sr = client.post("/score", json=p)
            eid = sr.json()["event_id"]
            assert eid is not None
            event_ids.append(eid)

        for eid, label in zip(event_ids, labels, strict=False):
            client.post("/feedback", json={"event_id": eid, "feedback": label})

        r = client.post(
            "/train/from-store",
            json={
                "model_name": "test_v1",
                "activate": True,
                "min_samples": 2,
                "min_classes": 2,
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "trained"
        assert body["samples"] == 4
        assert body["features"] == 7  # build_feature_vector returns 7
        assert 0.0 <= body["accuracy"] <= 1.0
        assert body["active"] is True
        assert body["active_model"] == "test_v1"

        # Verify the model appears in the registry
        mr = client.get("/models")
        model_names = [m["name"] for m in mr.json()["models"]]
        assert "test_v1" in model_names
        assert mr.json()["active"] == "test_v1"

    def test_train_from_store_min_samples_not_met(self, client: TestClient) -> None:
        sr = client.post("/score", json={"subject": "GX"})
        client.post("/feedback", json={"event_id": sr.json()["event_id"], "feedback": 0})
        r = client.post(
            "/train/from-store",
            json={"model_name": "v1", "min_samples": 10, "min_classes": 1},
        )
        assert r.status_code == 400

    def test_train_from_store_min_classes_not_met(self, client: TestClient) -> None:
        for _ in range(3):
            sr = client.post("/score", json={"subject": "GX"})
            client.post("/feedback", json={"event_id": sr.json()["event_id"], "feedback": 0})
        r = client.post(
            "/train/from-store",
            json={"model_name": "v1", "min_samples": 2, "min_classes": 2},
        )
        assert r.status_code == 400
