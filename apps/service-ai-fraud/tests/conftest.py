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

Test paths: ``EVENT_STORE_PATH`` and ``MODELS_DIR`` default to ``/app/…``
for production but are redirected to ``tmp_path`` in tests to avoid
permission errors in CI.  The env vars are set **before** importing
``src.api`` so that its module-level constants pick up the test values.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Redirect file-backed storage to a temporary directory so that tests never
# write to /app/… (which is read-only in most CI environments).
# ---------------------------------------------------------------------------
_tmp = tempfile.mkdtemp(prefix="ssi_fraud_test_")
os.environ.setdefault("MODELS_DIR", f"{_tmp}/models")
os.environ.setdefault("EVENT_STORE_PATH", f"{_tmp}/events.jsonl")

# Resolvable via pyproject `pythonpath = ["."]`; see header note.
# The env-var setup above is required — these constants are evaluated at
# module load time and must see the redirected test paths.
from src.api import app  # noqa: E402
from src.models.fraud_detector import FraudDetector, HeuristicDetector  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient bound to the real app instance.

    Note: this fixture does **not** use a context manager, so
    ``@app.on_event("startup")`` handlers are **not** triggered.
    Tests that need the event store / model registry should define
    their own context-managed fixture (see ``test_pipeline.py``).
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
