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

MODEL_PATH = Path(__import__('os').environ.get("MODEL_PATH", "/app/models/fraud_v1.joblib"))

app = FastAPI(title="SSI Fraud Detector", version="0.1.0")

# Load model lazily so dev environments without a .joblib still start.
detector: Any = FraudDetector(MODEL_PATH) if MODEL_PATH.exists() else HeuristicDetector()


class ScoreRequest(BaseModel):
    subject: str
    issuer:  str | None = None
    schema_hash: str | None = None
    biometric_commitment: str | None = None
    ip_country: str | None = None


class ScoreResponse(BaseModel):
    score: float
    explanation: dict[str, float]


@app.get("/health")
def health():
    return {"status": "ok", "model": type(detector).__name__}


@app.post("/score", response_model=ScoreResponse)
def score(body: ScoreRequest):
    result = detector.score(body.model_dump())
    return ScoreResponse(score=result["score"], explanation=result["explanation"])


@app.post("/train")
def train():
    raise HTTPException(status_code=501, detail="training pipeline is in scope for Phase 2")
