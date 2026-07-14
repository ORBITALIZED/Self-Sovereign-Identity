"""Shared pytest fixtures for the AI fraud service.

The fraud service can run in two modes:

* `HeuristicDetector` (always available, deterministic) — useful for unit
  tests that don't depend on a trained model.
* `FraudDetector` (joblib-backed, conditionally available) — used when a
  real model has been trained and saved to `MODEL_PATH`.

The fixtures below let tests opt into either behaviour explicitly.

Note: tests rely on `pyproject.toml`'s `pythonpath = ["."]` combined with
`src/__init__.py`, which makes `src` a normal package. Imports go through
the package path (`from src.api import app`) so the relative imports
inside `src/api.py` resolve as `src.<module>`.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Resolvable via pyproject `pythonpath = ["."]`; see header note.
from src.api import app  # noqa: E402
from src.models.fraud_detector import FraudDetector, HeuristicDetector  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient bound to the real app instance.

    Tests can use this as a smoke-test client; no lifespan events are
    triggered because the app has none.
    """
    return TestClient(app)


@pytest.fixture
def heuristic() -> HeuristicDetector:
    """A bare `HeuristicDetector` for pure-function tests (no HTTP)."""
    return HeuristicDetector()


@pytest.fixture
def maybe_model() -> FraudDetector:
    """Resolve whichever detector the running service has loaded.

    Tests that need the model can parametrise against this fixture to
    skip gracefully when no `.joblib` is present in CI.
    """
    if os.environ.get("MODEL_PATH") and Path(os.environ["MODEL_PATH"]).exists():
        return FraudDetector(Path(os.environ["MODEL_PATH"]))
    pytest.skip("no real model on disk; run only on hosts with a trained .joblib")
