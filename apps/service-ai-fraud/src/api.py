"""FastAPI app exposing /health, /score, /train, /feedback, /events, /models.

The fraud scoring is intentionally pluggable: when ML infrastructure is
absent (e.g. during local scaffolding) we fall back to a tiny deterministic
heuristic so the rest of the system still works.

Data pipeline
-------------
Score events are persisted to an append-only JSONL event store and can be
retrospectively labelled via /feedback.  A /train/from-store endpoint
retrains the model from accumulated labelled events, producing a new
.joblib that is registered in the model registry and optionally activated.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from .models.fraud_detector import FraudDetector, HeuristicDetector

# ---------------------------------------------------------------------------
# Module-level configuration
# ---------------------------------------------------------------------------

MODEL_PATH = Path(os.environ.get("MODEL_PATH", "/app/models/fraud_v1.joblib"))
MODELS_DIR = Path(os.environ.get("MODELS_DIR", "/app/models"))
EVENT_STORE_PATH = Path(os.environ.get("EVENT_STORE_PATH", "/app/data/events.jsonl"))
STORE_EVENTS = os.environ.get("FRAUD_STORE_EVENTS", "true").lower() in ("1", "true", "yes")

# ---------------------------------------------------------------------------
# Lazy-loaded singletons (initialised on first request via lifespan)
# ---------------------------------------------------------------------------

detector: Any = HeuristicDetector()
event_store: Any = None
model_registry: Any = None

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="SSI Fraud Detector", version="0.2.0")


@app.on_event("startup")
async def _init_pipeline() -> None:
    """Initialise the detector, event store, and model registry on startup."""
    global detector, event_store, model_registry  # noqa: PLW0603

    # -- Detector ----------------------------------------------------------
    detector = FraudDetector(MODEL_PATH) if MODEL_PATH.exists() else HeuristicDetector()

    # -- Event store -------------------------------------------------------
    from .store import EventStore
    event_store = EventStore(EVENT_STORE_PATH)

    # -- Model registry ----------------------------------------------------
    from .registry import ModelRegistry
    model_registry = ModelRegistry(MODELS_DIR)

    # If there is an active model, switch to it
    active_name = model_registry.get_active()
    if active_name:
        active_path = MODELS_DIR / f"{active_name}.joblib"
        if active_path.exists():
            detector = FraudDetector(active_path)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ScoreRequest(BaseModel):
    subject: str
    issuer: str | None = None
    schema_hash: str | None = None
    biometric_commitment: str | None = None
    ip_country: str | None = None


class ScoreResponse(BaseModel):
    score: float
    explanation: dict[str, float]
    event_id: str | None = None  # populated when event storage is enabled


class TrainRequest(BaseModel):
    """Training request: rows of labelled issuance events."""
    rows: list[dict[str, Any]]
    model_name: str = "fraud_v1"
    export: bool = False


class FeedbackRequest(BaseModel):
    """Human feedback label for a previously scored event."""
    event_id: str
    feedback: int  # 0 = legitimate, 1 = fraud


class TrainFromStoreRequest(BaseModel):
    """Request to retrain the model from stored labelled events."""
    model_name: str = "fraud_v2"
    activate: bool = True
    min_samples: int = 10        # minimum labelled events required
    min_classes: int = 2         # need both 0 and 1 labels


class ActivateModelRequest(BaseModel):
    name: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "model": type(detector).__name__,
        "events": event_store.count() if event_store else {},
        "active_model": model_registry.get_active() if model_registry else None,
    }


@app.post("/score", response_model=ScoreResponse)
def score(body: ScoreRequest) -> ScoreResponse:
    result = detector.score(body.model_dump())
    event_id: str | None = None

    if STORE_EVENTS and event_store is not None:
        event_id = event_store.append(body.model_dump(), result["score"])

    return ScoreResponse(
        score=result["score"],
        explanation=result["explanation"],
        event_id=event_id,
    )


@app.post("/feedback")
def feedback(body: FeedbackRequest) -> dict[str, Any]:
    """Submit a human label (0=legitimate, 1=fraud) for a previously scored event.

    Raises 404 if the *event_id* is not found in the store.
    """
    if body.feedback not in (0, 1):
        raise HTTPException(status_code=422, detail="feedback must be 0 (legitimate) or 1 (fraud)")

    if event_store is None:
        raise HTTPException(status_code=503, detail="event store not initialised")

    ok = event_store.label(body.event_id, body.feedback)
    if not ok:
        raise HTTPException(status_code=404, detail=f"event {body.event_id} not found")

    return {"status": "labelled", "event_id": body.event_id, "feedback": body.feedback}


@app.get("/events")
def list_events(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    labelled_only: bool = Query(False),
) -> dict[str, Any]:
    """List stored score events with optional pagination and filtering."""
    if event_store is None:
        raise HTTPException(status_code=503, detail="event store not initialised")

    events = event_store.get_all(limit=limit, offset=offset, labelled_only=labelled_only)
    counts = event_store.count()
    return {
        "events": events,
        "count": len(events),
        "total": counts["total"],
        "labelled": counts["labelled"],
        "unlabelled": counts["unlabelled"],
        "limit": limit,
        "offset": offset,
    }


@app.get("/events/count")
def event_counts() -> dict[str, int]:
    """Return total, labelled, and unlabelled event counts."""
    if event_store is None:
        raise HTTPException(status_code=503, detail="event store not initialised")
    counts: dict[str, int] = event_store.count()
    return counts


@app.post("/train")
def train(body: TrainRequest) -> dict[str, Any]:
    """Train a logistic regression model on labelled issuance data.

    Accepts a list of labelled rows (each with pre-computed feature columns
    + a 'label' field of 0 or 1), fits a scikit-learn LogisticRegression
    model, and optionally exports it to MODEL_PATH for future scoring.
    """
    try:
        import joblib
        from sklearn.linear_model import LogisticRegression

        from .features.extract import build_training_matrix
    except ImportError as e:
        raise HTTPException(status_code=501, detail=f"training dependencies missing: {e}") from e

    if not body.rows:
        raise HTTPException(status_code=400, detail="rows must not be empty")

    X, y = build_training_matrix(body.rows)

    if len(set(y.tolist())) < 2:
        raise HTTPException(status_code=400, detail="need both positive and negative examples")

    model = LogisticRegression(max_iter=1000, class_weight="balanced")
    model.fit(X, y)

    result: dict[str, Any] = {
        "status": "trained",
        "samples": len(body.rows),
        "features": X.shape[1],
        "accuracy": float(model.score(X, y)),
    }

    if body.export:
        out = MODEL_PATH.parent / f"{body.model_name}.joblib"
        joblib.dump(model, out)
        result["exported"] = str(out)

        # Register the model in the registry
        if model_registry is not None:
            model_registry.register(body.model_name, {
                "accuracy": result["accuracy"],
                "samples": result["samples"],
                "features": result["features"],
                "algorithm": "LogisticRegression",
                "source": "train_inline",
            })

    return result


@app.post("/train/from-store")
def train_from_store(body: TrainFromStoreRequest) -> dict[str, Any]:
    """Retrain the model from accumulated labelled events in the event store.

    Features are computed fresh from each stored event's raw payload using
    the same :func:`build_feature_vector` used during real-time scoring.

    The trained model is exported as a ``.joblib`` file and registered in the
    model registry. If *activate* is True (default), the new model becomes
    the active detector immediately.
    """
    try:
        import joblib
        from sklearn.linear_model import LogisticRegression

        from .features.extract import build_training_matrix_from_events
    except ImportError as e:
        raise HTTPException(status_code=501, detail=f"training dependencies missing: {e}") from e

    if event_store is None:
        raise HTTPException(status_code=503, detail="event store not initialised")

    labelled = event_store.get_labelled()
    if len(labelled) < body.min_samples:
        raise HTTPException(
            status_code=400,
            detail=f"need at least {body.min_samples} labelled events, got {len(labelled)}",
        )

    X, y = build_training_matrix_from_events(labelled)

    unique_labels = set(y.tolist())
    if len(unique_labels) < body.min_classes:
        raise HTTPException(
            status_code=400,
            detail=(
                f"need {body.min_classes} distinct feedback classes (0 and 1), "
                f"got {unique_labels}"
            ),
        )

    model = LogisticRegression(max_iter=1000, class_weight="balanced")
    model.fit(X, y)

    out_path = MODELS_DIR / f"{body.model_name}.joblib"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_path)

    accuracy = float(model.score(X, y))

    # Register in the model registry
    if model_registry is not None:
        model_registry.register(body.model_name, {
            "accuracy": accuracy,
            "samples": len(labelled),
            "features": X.shape[1],
            "algorithm": "LogisticRegression",
            "source": "train_from_store",
        })

    # Optionally activate
    if body.activate and model_registry is not None:
        model_registry.set_active(body.model_name)
        # Reload the detector
        global detector  # noqa: PLW0603
        detector = FraudDetector(out_path)

    return {
        "status": "trained",
        "samples": len(labelled),
        "features": X.shape[1],
        "accuracy": accuracy,
        "exported": str(out_path),
        "active": body.activate,
        "active_model": body.model_name if body.activate else model_registry.get_active(),
    }


@app.get("/models")
def list_models() -> dict[str, Any]:
    """Return all registered models with metadata."""
    if model_registry is None:
        raise HTTPException(status_code=503, detail="model registry not initialised")
    models = model_registry.list_models()
    active = model_registry.get_active()
    return {
        "models": models,
        "active": active,
        "count": len(models),
    }


@app.post("/models/activate")
def activate_model(body: ActivateModelRequest) -> dict[str, Any]:
    """Switch the active detector to a previously trained model.

    The model's ``.joblib`` file must exist at ``MODELS_DIR / {name}.joblib``.
    """
    if model_registry is None:
        raise HTTPException(status_code=503, detail="model registry not initialised")

    ok = model_registry.set_active(body.name)
    if not ok:
        raise HTTPException(
            status_code=404,
            detail=(
                f"model '{body.name}' not found in registry. "
                "Train it first via /train or /train/from-store."
            ),
        )

    model_path = MODELS_DIR / f"{body.name}.joblib"
    if not model_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"model file '{model_path}' not found on disk",
        )

    global detector  # noqa: PLW0603
    detector = FraudDetector(model_path)

    return {"status": "activated", "model": body.name}
