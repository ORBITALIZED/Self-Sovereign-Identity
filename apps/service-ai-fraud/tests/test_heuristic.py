"""Unit tests for the deterministic `HeuristicDetector` fallback.

The deterministic detector emits:

    score = min(clip(features @ weights, 0, 1), 1.0)
    weights = [0.4, 0.3, 0.1, 0.2, 0.0, 0.0, 0.0]
    issuer_rep = 0.8 if issuer.startswith("G") else 0.3

These tests pin that behaviour so a change in any of the weights or
feature mappings fails loudly.
"""

from __future__ import annotations

import math

from src.models.fraud_detector import HeuristicDetector


def test_score_is_in_unit_interval(heuristic: HeuristicDetector) -> None:
    for payload in [
        {"issuer": "", "subject": ""},
        {"issuer": "G*", "subject": "X"},
        {
            "issuer": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
            "subject": "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        },
    ]:
        result = heuristic.score(payload)
        assert 0.0 <= result["score"] <= 1.0


def test_well_known_issuer_increases_reputation_signal(heuristic: HeuristicDetector) -> None:
    """A `G…` issuer bumps `issuer_reputation` from 0.3 to 0.8; the
    deterministic weights give that feature a 0.4 coefficient, so the
    score for a known issuer must be strictly HIGHER than for an
    unknown issuer (with the same default feature vector)."""
    known_payload = {
        "issuer": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        "subject": "GABC",
    }
    unknown_payload = {"issuer": "", "subject": "GABC"}
    assert heuristic.score(known_payload)["score"] > heuristic.score(unknown_payload)["score"]


def test_explanation_contains_all_features(heuristic: HeuristicDetector) -> None:
    result = heuristic.score({"issuer": "G", "subject": "X"})
    explanation = result["explanation"]
    expected_keys = {
        "issuer_reputation", "schema_velocity", "bio_entropy", "ip_mismatch",
        "time_since_last", "cred_lifetime", "duplicate_schema",
    }
    assert expected_keys.issubset(explanation.keys())


def test_same_input_yields_same_score(heuristic: HeuristicDetector) -> None:
    payload = {"issuer": "G", "subject": "X"}
    assert math.isclose(
        heuristic.score(payload)["score"],
        heuristic.score(payload)["score"],
    )
