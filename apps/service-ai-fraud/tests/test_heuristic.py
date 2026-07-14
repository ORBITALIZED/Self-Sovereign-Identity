"""Unit tests for the deterministic `HeuristicDetector` fallback."""

from __future__ import annotations

import math


def test_score_is_in_unit_interval(heuristic) -> None:
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


def test_well_known_issuer_lowers_score(heuristic) -> None:
    unknown = heuristic.score({"issuer": "", "subject": "GABC"})
    known = heuristic.score(
        {"issuer": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "subject": "GABC"}
    )
    # A "G…" address bumps issuer_rep from 0.5 → 1.0, which the heuristic
    # weights positively; the deterministic score should be lower (i.e.
    # less risky) for the known-issuer case.
    assert known["score"] <= unknown["score"]


def test_explanation_contains_all_features(heuristic) -> None:
    result = heuristic.score({"issuer": "G", "subject": "X"})
    explanation = result["explanation"]
    expected_keys = {"issuer_reputation", "schema_velocity", "bio_entropy", "ip_mismatch"}
    assert expected_keys.issubset(explanation.keys())


def test_same_input_yields_same_score(heuristic) -> None:
    payload = {"issuer": "G", "subject": "X"}
    assert math.isclose(
        heuristic.score(payload)["score"],
        heuristic.score(payload)["score"],
    )
