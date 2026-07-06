"""Feature extraction utilities used at training time.

The full pipeline ingests labelled issuance events from Postgres and turns
them into a (n_samples, n_features) X / y pair for fit().
"""

from __future__ import annotations
import numpy as np


def build_training_matrix(rows: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    """Convert raw DB rows into (X, y) suitable for scikit-learn fit().

    Each row is expected to have:
        issuer_rep, schema_velocity, bio_entropy, ip_mismatch, label (0/1).
    Unknown keys get a default of 0.
    """
    keys = ("issuer_rep", "schema_velocity", "bio_entropy", "ip_mismatch")
    X = np.array([[float(r.get(k, 0.0)) for k in keys] for r in rows], dtype=np.float32)
    y = np.array([int(r.get("label", 0)) for r in rows], dtype=np.int32)
    return X, y
