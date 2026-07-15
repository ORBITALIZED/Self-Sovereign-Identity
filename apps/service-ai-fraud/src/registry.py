"""Model registry — track metadata about trained models.

Models are persisted as ``.joblib`` files in a common directory. A
``registry.json`` index stores metadata (accuracy, feature count, version,
training timestamp) for each model. An ``active.txt`` file stores the name of
the currently active model.

Thread-safe via threading.Lock (single-process Uvicorn workers only).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any


class ModelRegistry:
    """Tracks metadata about trained models stored as .joblib files.

    Directory layout::

        /app/models/
            fraud_v1.joblib
            fraud_v2.joblib
            registry.json    # metadata index
            active.txt       # currently active model name
    """

    def __init__(self, models_dir: Path) -> None:
        self.models_dir = models_dir
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.registry_path = models_dir / "registry.json"
        self.active_path = models_dir / "active.txt"
        self._lock = Lock()
        self._init_registry()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _init_registry(self) -> None:
        if not self.registry_path.exists():
            with self._lock:
                self.registry_path.write_text("[]", encoding="utf-8")

    def _read_registry(self) -> list[dict[str, Any]]:
        if not self.registry_path.exists():
            return []
        try:
            raw = self.registry_path.read_text(encoding="utf-8")
            return list(json.loads(raw)) if raw.strip() else []
        except (json.JSONDecodeError, OSError):
            return []

    def _write_registry(self, registry: list[dict[str, Any]]) -> None:
        self.registry_path.write_text(
            json.dumps(registry, indent=2, default=str),
            encoding="utf-8",
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def register(self, name: str, metadata: dict[str, Any]) -> None:
        """Register or update a model's metadata in the registry.

        *metadata* is merged with the auto-populated ``name`` and
        ``created_at`` fields.
        """
        with self._lock:
            registry = self._read_registry()
            entry: dict[str, Any] = dict(metadata)
            entry["name"] = name
            entry["created_at"] = datetime.now(UTC).isoformat()
            # Replace any previous entry with the same name
            registry = [m for m in registry if m.get("name") != name]
            registry.append(entry)
            self._write_registry(registry)

    def list_models(self) -> list[dict[str, Any]]:
        """Return all registered models sorted newest-first."""
        models = self._read_registry()
        models.sort(key=lambda m: str(m.get("created_at", "")), reverse=True)
        return models

    def get_active(self) -> str | None:
        """Return the name of the currently active model, or None."""
        if self.active_path.exists():
            name = self.active_path.read_text(encoding="utf-8").strip()
            return name if name else None
        return None

    def set_active(self, name: str) -> bool:
        """Set *name* as the active model.

        Returns False if no model with that name is registered.
        """
        models = self._read_registry()
        if not any(m.get("name") == name for m in models):
            return False
        self.active_path.write_text(name, encoding="utf-8")
        return True

    def get(self, name: str) -> dict[str, Any] | None:
        """Look up a single model's metadata by name."""
        for m in self._read_registry():
            if m.get("name") == name:
                return m
        return None
