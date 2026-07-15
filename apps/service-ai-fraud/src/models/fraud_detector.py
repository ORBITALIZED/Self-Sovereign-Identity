"""Fraud detector — pluggable back-end.

`FraudDetector`     — uses a persisted joblib model (sklearn/XGBoost).
`HeuristicDetector` — deterministic fallback for development.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np


@dataclass
class Feature:
    """One-hot / hashable signal we feed to the model."""
    name: str
    value: float


def _build_feature_vector(payload: dict) -> np.ndarray:
    """
    Build a (very small) feature row from the request payload.

    Features (placeholder; real model would use many more):
      0 — issuer reputation  (1.0 == well known, 0 == unknown)
      1 — schema_velocity    (credentials issued for this schema in last 24h)
      2 — biometric_entropy  (Shannon entropy of template; 0=identical replays)
      3 — ip_country_mismatch (1 if subject country != issuer country)
    """
    issuer = payload.get("issuer") or ""

    issuer_rep = 1.0 if issuer.startswith("G") else 0.5  # placeholder heuristic
    schema_velocity = 0.0   # TODO: query MongoDB / Postgres for velocity
    bio_entropy = 0.7       # TODO: actual Shannon entropy from the template
    ip_mismatch  = 0.0      # TODO: asn/ipdb lookup

    return np.array([issuer_rep, schema_velocity, bio_entropy, ip_mismatch], dtype=np.float32)


class FraudDetector:
    """
    Wraps a persisted scikit-learn / XGBoost model loaded from disk.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self.model = None
        try:
            import joblib
            self.model = joblib.load(path)
        except Exception as e:  # pragma: no cover
            print(f"[fraud] WARN — failed to load model at {path}: {e}", flush=True)
            self.model = None

    def available(self) -> bool:
        return self.model is not None

    def score(self, payload: dict) -> dict:
        if self.model is None:
            return {"score": 0.0, "explanation": {"reason": "model_unavailable"}}
        x = _build_feature_vector(payload).reshape(1, -1)
        score = float(self.model.predict_proba(x)[0, 1])
        return {
            "score": score,
            "explanation": {
                "issuer_reputation": float(x[0, 0]),
                "schema_velocity":   float(x[0, 1]),
                "bio_entropy":       float(x[0, 2]),
                "ip_mismatch":       float(x[0, 3]),
            },
        }


class HeuristicDetector:
    """Deterministic fallback for dev / CI environments without joblib models."""

    def score(self, payload: dict) -> dict:
        x = _build_feature_vector(payload)
        # Weights chosen so an unknown issuer + repeated schema + ip mismatch
        # pushes the score above the threshold.
        weights = np.array([0.4, 0.3, 0.1, 0.2], dtype=np.float32)
        score = float(np.clip(x @ weights, 0.0, 1.0))
        return {
            "score": score,
            "explanation": {
                "issuer_reputation": float(x[0]),
                "schema_velocity":   float(x[1]),
                "bio_entropy":       float(x[2]),
                "ip_mismatch":       float(x[3]),
            },
        }
