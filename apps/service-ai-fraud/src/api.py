"""FastAPI app exposing /health, /score, /train and /explain.

The fraud scoring is intentionally pluggable: when ML infrastructure is
absent (e.g. during local scaffolding) we fall back to a tiny deterministic
heuristic so the rest of the system still works.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .models.fraud_detector import FraudDetector, HeuristicDetector

MODEL_PATH = Path(__import__("os").environ.get("MODEL_PATH", "/app/models/fraud_v1.joblib"))

app = FastAPI(title="SSI Fraud Detector", version="0.1.0")

# Load model lazily so dev environments without a .joblib still start.
detector: Any = FraudDetector(MODEL_PATH) if MODEL_PATH.exists() else HeuristicDetector()


class ScoreRequest(BaseModel):
    subject: str
    issuer: str | None = None
    schema_hash: str | None = None
    biometric_commitment: str | None = None
    ip_country: str | None = None


class ScoreResponse(BaseModel):
    score: float
    explanation: dict[str, float]


class TrainRequest(BaseModel):
    """Training request: rows of labelled issuance events."""
    rows: list[dict[str, Any]]
    model_name: str = "fraud_v1"
    export: bool = False


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "model": type(detector).__name__}


@app.post("/score", response_model=ScoreResponse)
def score(body: ScoreRequest) -> ScoreResponse:
    result = detector.score(body.model_dump())
    return ScoreResponse(score=result["score"], explanation=result["explanation"])


@app.post("/train")
def train(body: TrainRequest) -> dict[str, Any]:
    """Train a logistic regression model on labelled issuance data.

    Accepts a list of labelled rows (each with feature columns + a 'label'
    field of 0 or 1), fits a scikit-learn LogisticRegression model, and
    optionally exports it to MODEL_PATH for future scoring.
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

    if len(set(y.tolist())) < 2:  # noqa: PLR2004
        raise HTTPException(status_code=400, detail="need both positive and negative examples")

    model = LogisticRegression(max_iter=1000, class_weight="balanced")
    model.fit(X, y)

    if body.export:
        out = MODEL_PATH.parent / f"{body.model_name}.joblib"
        joblib.dump(model, out)
        return {
            "status": "trained",
            "samples": len(body.rows),
            "features": X.shape[1],
            "accuracy": float(model.score(X, y)),
            "exported": str(out),
        }

    return {
        "status": "trained",
        "samples": len(body.rows),
        "features": X.shape[1],
        "accuracy": float(model.score(X, y)),
    }
