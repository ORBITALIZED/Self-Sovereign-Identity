"""Feature extraction utilities used at training time.

The full pipeline ingests labelled issuance events from Postgres and turns
them into a (n_samples, n_features) X / y pair for fit().

Features extracted (7 total):
  0 — issuer_reputation    (1.0 = well-known issuer, 0 = unknown)
  1 — schema_velocity      (credentials issued for this schema in last 24h)
  2 — biometric_entropy    (Shannon entropy of biometric template)
  3 — ip_country_mismatch  (1 if subject IP country != issuer country)
  4 — time_since_last_issue (hours since last credential from this issuer)
  5 — credential_lifetime   (valid_until - issued_at, normalized)
  6 — duplicate_schema       (1 if subject already holds this schema)
"""

from __future__ import annotations

import math
from collections import Counter
from typing import Any

import numpy as np
from numpy.typing import NDArray


def _shannon_entropy(data: bytes) -> float:
    """Compute Shannon entropy of a byte sequence (biometric template)."""
    if not data:
        return 0.0
    counts = Counter(data)
    total = len(data)
    entropy = 0.0
    for count in counts.values():
        if count > 0:
            p = count / total
            entropy -= p * math.log2(p)
    return entropy / 8.0  # normalize to [0, 1]


def _issuer_reputation(issuer: str) -> float:
    """Heuristic issuer reputation based on address characteristics."""
    if not issuer:
        return 0.0
    # Well-formed Stellar addresses start with G
    if issuer.startswith("G") and len(issuer) == 56:  # noqa: PLR2004
        return 0.8
    # EVM addresses start with 0x
    if issuer.startswith("0x") and len(issuer) == 42:  # noqa: PLR2004
        return 0.7
    return 0.3


def build_feature_vector(
    payload: dict[str, Any],
    history: list[dict[str, Any]] | None = None,
) -> NDArray[np.float32]:
    """
    Build a 7-element feature vector from the request payload and optional
    historical data for velocity/lifetime computation.

    Args:
        payload: The current issuance request with keys:
            issuer, subject, schema_hash, biometric_commitment, ip_country, valid_until
        history: Optional list of previous issuances for the same subject/issuer
    """
    issuer = str(payload.get("issuer") or "")
    subject = str(payload.get("subject") or "")
    schema_hash = str(payload.get("schema_hash") or "")
    bio_commit = payload.get("biometric_commitment")
    ip_country = str(payload.get("ip_country") or "")
    valid_until = int(payload.get("valid_until") or 0)

    # Feature 0: issuer reputation
    issuer_rep = _issuer_reputation(issuer)

    # Feature 1: schema velocity (count in last 24h)
    schema_velocity = 0.0
    if history:
        # Use nanosecond ints for type-safe comparison (issued_at is also an int).
        cutoff_ns = int(
            np.datetime64("now", "ns") - np.timedelta64(24, "h")
        )
        schema_velocity = sum(
            1
            for h in history
            if h.get("schema_hash") == schema_hash
            and int(h.get("issued_at", 0)) > cutoff_ns
        )

    # Feature 2: biometric entropy
    bio_entropy = 0.0
    if bio_commit:
        try:
            raw = bytes.fromhex(str(bio_commit))
            bio_entropy = _shannon_entropy(raw)
        except (ValueError, TypeError):
            bio_entropy = 0.5  # fallback for malformed input

    # Feature 3: IP country mismatch
    issuer_country = str(payload.get("issuer_country") or "")
    ip_mismatch = 1.0 if issuer_country and ip_country and issuer_country != ip_country else 0.0

    # Feature 4: time since last issue from this issuer (hours)
    time_since_last = 0.0
    if history:
        issuer_issues = [h for h in history if h.get("issuer") == issuer]
        if issuer_issues:
            last_ts = max(int(h.get("issued_at", 0)) for h in issuer_issues)
            if last_ts > 0:
                now_ns = int(np.datetime64("now", "ns"))
                time_since_last = max(
                    0.0, (now_ns - last_ts) / 3_600_000_000_000
                )  # ns → hours

    # Feature 5: credential lifetime (normalized)
    cred_lifetime = 0.0
    if valid_until > 0:
        now_ts = int(np.datetime64("now").astype(np.int64) / 1_000_000_000)  # to seconds
        lifetime_secs = max(0, valid_until - now_ts)
        cred_lifetime = min(1.0, lifetime_secs / (365 * 24 * 3600))  # normalize to [0,1] years

    # Feature 6: duplicate schema (subject already holds this schema)
    duplicate = 0.0
    if history:
        for h in history:
            if h.get("subject") == subject and h.get("schema_hash") == schema_hash:
                duplicate = 1.0
                break

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


def build_training_matrix(
    rows: list[dict[str, Any]],
) -> tuple[NDArray[np.float32], NDArray[np.int32]]:
    """Convert raw DB rows into (X, y) suitable for scikit-learn fit()."""
    keys = (
        "issuer_rep", "schema_velocity", "bio_entropy", "ip_mismatch",
        "time_since_last", "cred_lifetime", "duplicate_schema",
    )
    X: NDArray[np.float32] = np.array(
        [[float(r.get(k, 0.0)) for k in keys] for r in rows],
        dtype=np.float32,
    )
    y: NDArray[np.int32] = np.array(
        [int(r.get("label", 0)) for r in rows],
        dtype=np.int32,
    )
    return X, y


def build_training_matrix_from_events(
    events: list[dict[str, Any]],
) -> tuple[NDArray[np.float32], NDArray[np.int32]]:
    """Build (X, y) from stored labelled events with raw payloads.

    Each event in the list should have:
      - ``payload``: dict with keys consumed by :func:`build_feature_vector`
        (issuer, subject, schema_hash, biometric_commitment, ip_country,
        issuer_country, valid_until)
      - ``feedback``: int 0 (legitimate) or 1 (fraud)

    The feature vector is computed fresh from each event's payload using
    :func:`build_feature_vector`, allowing the pipeline to work with the
    same features used during real-time scoring.
    """
    if not events:
        return np.empty((0, 7), dtype=np.float32), np.empty(0, dtype=np.int32)

    X_rows: list[NDArray[np.float32]] = []
    y_labels: list[int] = []
    for ev in events:
        payload = ev.get("payload", {})
        if not isinstance(payload, dict):
            payload = {}
        vec = build_feature_vector(payload)
        X_rows.append(vec)
        y_labels.append(int(ev.get("feedback", 0)))

    X: NDArray[np.float32] = np.stack(X_rows, axis=0)
    y: NDArray[np.int32] = np.array(y_labels, dtype=np.int32)
    return X, y
