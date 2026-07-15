"""Fraud detector — pluggable back-end.

`FraudDetector`     — uses a persisted joblib model (sklearn/XGBoost).
`HeuristicDetector` — deterministic fallback for development.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

from ..features.extract import _shannon_entropy


def _build_feature_vector(
    payload: dict[str, Any],
    history: list[dict[str, Any]] | None = None,
) -> NDArray[np.float32]:
    """
    Build a 4-element feature row from the request payload for real-time scoring.

    Features:
      0 — issuer_reputation   (1.0 = well-known, 0 = unknown)
      1 — schema_velocity     (credentials issued for this schema in last 24h)
      2 — biometric_entropy   (Shannon entropy of template; 0 = identical replays)
      3 — ip_country_mismatch (1 if subject country != issuer country)

    These match the first 4 features of the training vector in
    `features/extract.py` so the model weights are compatible.
    """
    issuer = str(payload.get("issuer") or "")
    schema_hash = str(payload.get("schema_hash") or "")
    bio_commit = payload.get("biometric_commitment")
    ip_country = str(payload.get("ip_country") or "")
    issuer_country = str(payload.get("issuer_country") or "")

    # Feature 0: issuer reputation (heuristic based on address characteristics)
    if issuer.startswith("G") and len(issuer) == 56:  # noqa: PLR2004
        issuer_rep = 0.8
    elif issuer.startswith("0x") and len(issuer) == 42:  # noqa: PLR2004
        issuer_rep = 0.7
    else:
        issuer_rep = 0.3

    # Feature 1: schema velocity (count in last 24h from history)
    schema_velocity = 0.0
    if history and schema_hash:
        cutoff_ns = int(
            np.datetime64("now", "ns") - np.timedelta64(24, "h")
        )
        schema_velocity = sum(
            1
            for h in history
            if str(h.get("schema_hash", "")) == schema_hash
            and int(h.get("issued_at", 0)) > cutoff_ns
        )

    # Feature 2: biometric entropy (Shannon entropy from hex commitment)
    bio_entropy = 0.0
    if bio_commit:
        try:
            raw = bytes.fromhex(str(bio_commit))
            bio_entropy = _shannon_entropy(raw)
        except (ValueError, TypeError):
            bio_entropy = 0.5  # fallback for malformed input

    # Feature 3: IP country mismatch
    ip_mismatch = 1.0 if issuer_country and ip_country and issuer_country != ip_country else 0.0

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

    def score(self, payload: dict[str, Any]) -> dict[str, Any]:
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

    def score(self, payload: dict[str, Any]) -> dict[str, Any]:
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
