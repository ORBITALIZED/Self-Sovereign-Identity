"""Shared pytest fixtures for the AI fraud service.

The fraud service can run in two modes:

* `HeuristicDetector` (always available, deterministic) — useful for unit
  tests that don't depend on a trained model.
* `FraudDetector` (joblib-backed, conditionally available) — used when a
  real model has been trained and saved to `MODEL_PATH`.

The fixtures below let tests opt into either behaviour explicitly.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

# Make the package's `src.` import path work without editable installs.
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(SRC))

from api import app  # noqa: E402  (import after sys.path tweak)
from models.fraud_detector import FraudDetector, HeuristicDetector  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient bound to the real app instance.

    Tests can use this as a smoke-test client; no lifespan events are
    triggered because the app has none.
    """
    return TestClient(app)


@pytest.fixture
def heuristic() -> Any:
    """A bare `HeuristicDetector` for pure-function tests (no HTTP)."""
    return HeuristicDetector()


@pytest.fixture
def maybe_model() -> Any:
    """Resolve whichever detector the running service has loaded.

    Tests that need the model can parametrise against this fixture to
    skip gracefully when no `.joblib` is present in CI.
    """
    if os.environ.get("MODEL_PATH") and Path(os.environ["MODEL_PATH"]).exists():
        return FraudDetector(Path(os.environ["MODEL_PATH"]))
    pytest.skip("no real model on disk; run only on hosts with a trained .joblib")
