"""Event store — append-only JSONL log of scored events for training data collection.

Each scored event is persisted as a JSON line in a JSONL file. Events can later
be labelled via the /feedback endpoint and used to retrain the fraud model.

Thread-safe via threading.Lock (single-process Uvicorn workers only; for
multi-worker deployments, replace with SQLite or Postgres).
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any


class EventStore:
    """Append-only log of scored events backed by a JSONL file.

    Each line is a JSON object with:
      - event_id:  UUID string (generated on append)
      - created_at: ISO-8601 timestamp
      - payload:    the ScoreRequest dict
      - score:      float returned by the detector
      - feedback:   int 0|1 or None (unlabelled)
      - source:     "score" | "feedback"
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, payload: dict[str, Any], score: float) -> str:
        """Persist a scored event and return its event_id."""
        event: dict[str, Any] = {
            "event_id": str(uuid.uuid4()),
            "created_at": datetime.now(UTC).isoformat(),
            "payload": payload,
            "score": score,
            "feedback": None,
            "source": "score",
        }
        with self._lock:
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(json.dumps(event, default=str) + "\n")
        return str(event["event_id"])

    def _read_events(self) -> list[dict[str, Any]]:
        """Read all events from disk, returning an empty list if the file
        does not yet exist."""
        if not self.path.exists():
            return []
        events: list[dict[str, Any]] = []
        with open(self.path, encoding="utf-8") as f:
            for raw_line in f:
                stripped = raw_line.strip()
                if not stripped:
                    continue
                events.append(json.loads(stripped))
        return events

    def _write_events(self, events: list[dict[str, Any]]) -> None:
        """Atomically rewrite the entire store (used by ``label``)."""
        with open(self.path, "w", encoding="utf-8") as f:
            for ev in events:
                f.write(json.dumps(ev, default=str) + "\n")

    def label(self, event_id: str, feedback: int) -> bool:
        """Attach a human label (0=legitimate, 1=fraud) to an event.

        Returns False when *event_id* is not found or *feedback* is
        not 0 or 1.
        """
        if feedback not in (0, 1):
            return False

        with self._lock:
            events = self._read_events()
            updated = False
            for ev in events:
                if ev["event_id"] == event_id:
                    ev["feedback"] = feedback
                    ev["source"] = "feedback"
                    updated = True
                    break
            if updated:
                self._write_events(events)
        return updated

    def get_labelled(self) -> list[dict[str, Any]]:
        """Return all events that have received human feedback."""
        with self._lock:
            return [ev for ev in self._read_events() if ev.get("feedback") is not None]

    def get_unlabelled(self) -> list[dict[str, Any]]:
        """Return all events still awaiting feedback."""
        with self._lock:
            return [ev for ev in self._read_events() if ev.get("feedback") is None]

    def get_all(
        self,
        limit: int = 100,
        offset: int = 0,
        labelled_only: bool = False,
    ) -> list[dict[str, Any]]:
        """Paginated event listing.

        Args:
            limit:  Max events to return.
            offset: Number of events to skip.
            labelled_only: If True, only return events with feedback.
        """
        with self._lock:
            events = self._read_events()
        if labelled_only:
            events = [ev for ev in events if ev.get("feedback") is not None]
        return events[offset : offset + limit]

    def count(self) -> dict[str, int]:
        """Return total, labelled, and unlabelled event counts."""
        with self._lock:
            events = self._read_events()
        total = len(events)
        labelled = sum(1 for ev in events if ev.get("feedback") is not None)
        return {"total": total, "labelled": labelled, "unlabelled": total - labelled}

    def clear(self) -> None:
        """Remove all events (useful in tests)."""
        with self._lock:
            self.path.write_text("", encoding="utf-8")
