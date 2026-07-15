"""Fraud detector — pluggable back-end.

`FraudDetector`     — uses a persisted joblib model (sklearn/XGBoost).
`HeuristicDetector` — deterministic fallback for development.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

from ..features.extract import _issuer_reputation, _shannon_entropy

# --------------------------------------------------------------------------
# Feature helpers (extracted to satisfy Ruff PLR0912 branch-limit check)
# Note: _issuer_reputation is imported from extract.py instead of being
# duplicated here.  _shannon_entropy is also imported from that module.
# --------------------------------------------------------------------------


def _schema_velocity(
    history: list[dict[str, Any]] | None,
    schema_hash: str,
) -> float:
    """Count matching schema_hash events in the last 24h."""
    if not history or not schema_hash:
        return 0.0
    cutoff_ns = int(np.datetime64("now", "ns") - np.timedelta64(24, "h"))
    return float(
        sum(
            1
            for h in history
            if str(h.get("schema_hash", "")) == schema_hash
            and int(h.get("issued_at", 0)) > cutoff_ns
        )
    )


def _biometric_entropy(bio_commit: object | None) -> float:
    """Shannon entropy of hex-encoded biometric commitment."""
    if not bio_commit:
        return 0.0
    try:
        raw = bytes.fromhex(str(bio_commit))
        return float(_shannon_entropy(raw))
    except (ValueError, TypeError):
        return 0.5  # fallback for malformed input


def _time_since_last_issue(
    history: list[dict[str, Any]] | None,
    issuer: str,
) -> float:
    """Hours since the last credential from this issuer."""
    if not history:
        return 0.0
    issuer_issues = [h for h in history if str(h.get("issuer", "")) == issuer]
    if not issuer_issues:
        return 0.0
    last_ts = max(int(h.get("issued_at", 0)) for h in issuer_issues)
    if last_ts <= 0:
        return 0.0
    now_ns = int(np.datetime64("now", "ns"))
    return max(0.0, (now_ns - last_ts) / 3_600_000_000_000)  # ns -> hours


def _credential_lifetime(valid_until: int) -> float:
    """Normalised credential lifetime in [0, 1] over ~1 year."""
    if valid_until <= 0:
        return 0.0
    now_s = int(np.datetime64("now").astype(np.int64) / 1_000_000_000)
    lifetime_secs = max(0, valid_until - now_s)
    return float(min(1.0, lifetime_secs / (365 * 24 * 3600)))


def _duplicate_schema(
    history: list[dict[str, Any]] | None,
    subject: str,
    schema_hash: str,
) -> float:
    """1.0 if subject already holds this schema in history."""
    if not history:
        return 0.0
    for h in history:
        if str(h.get("subject", "")) == subject and str(h.get("schema_hash", "")) == schema_hash:
            return 1.0
    return 0.0


def _build_feature_vector(
    payload: dict[str, Any],
    history: list[dict[str, Any]] | None = None,
) -> NDArray[np.float32]:
    """
    Build a 7-element feature row from the request payload for real-time scoring.

    All 7 features match those in `features/extract.py`'s
    ``build_feature_vector`` so that models trained on full training
    matrices are compatible with the inference-time scorer.

    Features:
      0 — issuer_reputation     (0.8 Stellar, 0.7 EVM, 0.3 unknown)
      1 — schema_velocity       (credentials issued for this schema in last 24h)
      2 — biometric_entropy     (Shannon entropy of template; 0 = identical replays)
      3 — ip_country_mismatch   (1 if subject country != issuer country)
      4 — time_since_last_issue (hours since last credential from this issuer)
      5 — credential_lifetime   (valid_until - now, normalised to [0,1])
      6 — duplicate_schema      (1 if subject already holds this schema)
    """
    issuer = str(payload.get("issuer") or "")
    subject = str(payload.get("subject") or "")
    schema_hash = str(payload.get("schema_hash") or "")
    bio_commit = payload.get("biometric_commitment")
    ip_country = str(payload.get("ip_country") or "")
    issuer_country = str(payload.get("issuer_country") or "")
    valid_until = int(payload.get("valid_until") or 0)

    # Feature 0: issuer reputation (heuristic based on address characteristics)
    issuer_rep = _issuer_reputation(issuer)

    # Feature 1: schema velocity (count in last 24h from history)
    schema_velocity = _schema_velocity(history, schema_hash)

    # Feature 2: biometric entropy (Shannon entropy from hex commitment)
    bio_entropy = _biometric_entropy(bio_commit)

    # Feature 3: IP country mismatch
    ip_mismatch = 1.0 if issuer_country and ip_country and issuer_country != ip_country else 0.0

    # Feature 4: time since last issue from this issuer (hours)
    time_since_last = _time_since_last_issue(history, issuer)

    # Feature 5: credential lifetime (normalised to [0,1] across ~1 year)
    cred_lifetime = _credential_lifetime(valid_until)

    # Feature 6: duplicate schema (subject already holds this schema)
    duplicate = _duplicate_schema(history, subject, schema_hash)

    return np.array(
        [
            issuer_rep,
            schema_velocity,
            bio_entropy,
            ip_mismatch,
            time_since_last,
            cred_lifetime,
            duplicate,
        ],
        dtype=np.float32,
    )


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
                "issuer_reputation":   float(x[0, 0]),
                "schema_velocity":     float(x[0, 1]),
                "bio_entropy":         float(x[0, 2]),
                "ip_mismatch":         float(x[0, 3]),
                "time_since_last":     float(x[0, 4]),
                "cred_lifetime":       float(x[0, 5]),
                "duplicate_schema":    float(x[0, 6]),
            },
        }


class HeuristicDetector:
    """Deterministic fallback for dev / CI environments without joblib models."""

    def score(self, payload: dict[str, Any]) -> dict[str, Any]:
        x = _build_feature_vector(payload)
        # Weights chosen so an unknown issuer + repeated schema + ip mismatch
        # pushes the score above the threshold.
        # 7-element weights match the 7-feature vector from _build_feature_vector.
        # The 3 new features (time_since_last, cred_lifetime, duplicate) get zero
        # weight so they don't affect the deterministic score — they are only
        # meaningful when a trained model is loaded.
        weights = np.array([0.4, 0.3, 0.1, 0.2, 0.0, 0.0, 0.0], dtype=np.float32)
        score = float(np.clip(x @ weights, 0.0, 1.0))
        return {
            "score": score,
            "explanation": {
                "issuer_reputation":   float(x[0]),
                "schema_velocity":     float(x[1]),
                "bio_entropy":         float(x[2]),
                "ip_mismatch":         float(x[3]),
                "time_since_last":     float(x[4]),
                "cred_lifetime":       float(x[5]),
                "duplicate_schema":    float(x[6]),
            },
        }
