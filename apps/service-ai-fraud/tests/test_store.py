"""Unit tests for the JSONL-backed event store."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.store import EventStore


@pytest.fixture
def store(tmp_path: Path) -> EventStore:
    return EventStore(tmp_path / "events.jsonl")


class TestEventStore:
    def test_append_returns_id(self, store: EventStore) -> None:
        event_id = store.append({"subject": "GABC", "issuer": "GDEF"}, 0.5)
        assert isinstance(event_id, str)
        assert len(event_id) > 0

    def test_append_persists_to_disk(self, store: EventStore) -> None:
        store.append({"subject": "GX"}, 0.3)
        assert store.path.exists()
        content = store.path.read_text(encoding="utf-8").strip()
        assert len(content) > 0

    def test_count_initial(self, store: EventStore) -> None:
        assert store.count() == {"total": 0, "labelled": 0, "unlabelled": 0}

    def test_count_after_append(self, store: EventStore) -> None:
        store.append({"subject": "A"}, 0.1)
        store.append({"subject": "B"}, 0.9)
        assert store.count() == {"total": 2, "labelled": 0, "unlabelled": 2}

    def test_label_existing_event(self, store: EventStore) -> None:
        eid = store.append({"subject": "GX"}, 0.7)
        ok = store.label(eid, 1)
        assert ok is True
        assert store.count() == {"total": 1, "labelled": 1, "unlabelled": 0}

    def test_label_nonexistent_returns_false(self, store: EventStore) -> None:
        ok = store.label("does-not-exist", 0)
        assert ok is False

    def test_label_invalid_value_returns_false(self, store: EventStore) -> None:
        eid = store.append({"subject": "X"}, 0.5)
        ok = store.label(eid, 42)  # 42 is not 0 or 1
        assert ok is False

    def test_get_labelled(self, store: EventStore) -> None:
        eid1 = store.append({"subject": "A"}, 0.1)
        store.append({"subject": "B"}, 0.9)
        store.label(eid1, 0)
        labelled = store.get_labelled()
        assert len(labelled) == 1
        assert labelled[0]["event_id"] == eid1
        assert labelled[0]["feedback"] == 0

    def test_get_unlabelled(self, store: EventStore) -> None:
        eid1 = store.append({"subject": "A"}, 0.1)
        store.append({"subject": "B"}, 0.9)
        store.label(eid1, 0)
        unlabelled = store.get_unlabelled()
        assert len(unlabelled) == 1

    def test_get_all_pagination(self, store: EventStore) -> None:
        for i in range(10):
            store.append({"subject": str(i)}, i / 10.0)
        all_events = store.get_all(limit=3, offset=2)
        assert len(all_events) == 3

    def test_clear_removes_all(self, store: EventStore) -> None:
        store.append({"subject": "A"}, 0.5)
        store.append({"subject": "B"}, 0.5)
        store.clear()
        assert store.count() == {"total": 0, "labelled": 0, "unlabelled": 0}

    def test_round_trip_preserves_payload(self, store: EventStore) -> None:
        payload = {"subject": "GX", "issuer": "GY", "schema_hash": "0xabc"}
        eid = store.append(payload, 0.42)
        store.label(eid, 1)
        labelled = store.get_labelled()
        assert len(labelled) == 1
        ev = labelled[0]
        assert ev["event_id"] == eid
        assert ev["payload"] == payload
        assert ev["score"] == 0.42
        assert ev["feedback"] == 1

    def test_multiple_labels_on_same_event_overwrites(self, store: EventStore) -> None:
        eid = store.append({"subject": "X"}, 0.5)
        store.label(eid, 1)
        store.label(eid, 0)
        labelled = store.get_labelled()
        assert len(labelled) == 1
        assert labelled[0]["feedback"] == 0

    def test_count_unlabelled_after_partial_label(self, store: EventStore) -> None:
        store.append({"subject": "A"}, 0.1)
        eid = store.append({"subject": "B"}, 0.2)
        store.append({"subject": "C"}, 0.3)
        store.label(eid, 1)
        assert store.count() == {"total": 3, "labelled": 1, "unlabelled": 2}
