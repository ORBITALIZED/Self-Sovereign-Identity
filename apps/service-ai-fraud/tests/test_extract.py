"""Unit tests for the feature extraction pipeline in src/features/extract.py."""

from __future__ import annotations

import numpy as np

from src.features.extract import (
    _issuer_reputation,
    _shannon_entropy,
    build_feature_vector,
    build_training_matrix,
)


class TestShannonEntropy:
    def test_empty_data_returns_zero(self) -> None:
        assert _shannon_entropy(b"") == 0.0

    def test_uniform_data(self) -> None:
        """Uniform bytes (all same value) have zero entropy."""
        assert _shannon_entropy(b"\x00" * 100) == 0.0

    def test_diverse_data_has_positive_entropy(self) -> None:
        """Bytes with all 256 values present should have maximum entropy."""
        entropy = _shannon_entropy(bytes(range(256)))
        assert entropy == 1.0

    def test_normalized_to_zero_one(self) -> None:
        """Entropy is divided by 8, so max is ≤ 1.0."""
        for data in [b"\x00\xff" * 50, bytes([i % 256 for i in range(1000)])]:
            e = _shannon_entropy(data)
            assert 0.0 <= e <= 1.0


class TestIssuerReputation:
    def test_empty_issuer(self) -> None:
        assert _issuer_reputation("") == 0.0

    def test_stellar_issuer(self) -> None:
        addr = "G" + "A" * 55  # 56 chars total, valid shape
        assert _issuer_reputation(addr) == 0.8

    def test_short_stellar_like(self) -> None:
        """A G-prefixed but short address is not a well-formed Stellar key."""
        assert _issuer_reputation("GABC") == 0.3

    def test_evm_issuer(self) -> None:
        addr = "0x" + "a" * 40  # 42 chars total, valid shape
        assert _issuer_reputation(addr) == 0.7

    def test_unknown_issuer(self) -> None:
        assert _issuer_reputation("unknown-issuer") == 0.3


class TestBuildFeatureVector:
    def test_minimal_payload_returns_7_features(self) -> None:
        vec = build_feature_vector({})
        assert vec.shape == (7,)
        assert vec.dtype == np.float32

    def test_issuer_reputation_present(self) -> None:
        vec = build_feature_vector({"issuer": "G" + "A" * 55})
        assert vec[0] == np.float32(0.8)  # well-formed Stellar address; float32 exact match

    def test_ip_mismatch_detected(self) -> None:
        vec = build_feature_vector({
            "issuer_country": "US",
            "ip_country": "BR",
        })
        assert vec[3] == 1.0  # mismatch

    def test_ip_match(self) -> None:
        vec = build_feature_vector({
            "issuer_country": "US",
            "ip_country": "US",
        })
        assert vec[3] == 0.0

    def test_biometric_entropy_from_hex(self) -> None:
        """Valid hex biometric commitment should produce entropy."""
        vec = build_feature_vector({"biometric_commitment": "aabbccdd" * 8})
        assert vec[2] > 0.0  # bio_entropy

    def test_malformed_biometric_falls_back(self) -> None:
        vec = build_feature_vector({"biometric_commitment": "not-hex!!"})
        assert vec[2] == 0.5  # fallback entropy

    def test_history_enables_velocity(self) -> None:
        """With a matching schema in history, schema_velocity should be > 0."""
        now_ns = int(np.datetime64("now", "ns"))
        history = [{
            "schema_hash": "0xabc",
            "issued_at": now_ns - 60_000_000_000,  # 60 seconds ago in ns
        }]
        vec = build_feature_vector(
            {"schema_hash": "0xabc"},
            history=history,
        )
        assert vec[1] >= 1.0  # schema_velocity ≥ 1

    def test_duplicate_schema_detected(self) -> None:
        history = [{
            "subject": "GABC",
            "schema_hash": "0xabc",
            "issued_at": 0,  # needed to avoid TypeError in feature 4 extraction
        }]
        vec = build_feature_vector(
            {"subject": "GABC", "schema_hash": "0xabc"},
            history=history,
        )
        assert vec[6] == 1.0  # duplicate_schema


class TestBuildTrainingMatrix:
    def test_returns_correct_shapes(self) -> None:
        rows = [
            {"issuer_rep": 0.8, "schema_velocity": 1.0, "bio_entropy": 0.7,
             "ip_mismatch": 0.0, "time_since_last": 10.0, "cred_lifetime": 0.5,
             "duplicate_schema": 0.0, "label": 0},
            {"issuer_rep": 0.3, "schema_velocity": 5.0, "bio_entropy": 0.2,
             "ip_mismatch": 1.0, "time_since_last": 0.5, "cred_lifetime": 0.1,
             "duplicate_schema": 1.0, "label": 1},
            {"issuer_rep": 0.7, "schema_velocity": 2.0, "bio_entropy": 0.5,
             "ip_mismatch": 0.0, "time_since_last": 20.0, "cred_lifetime": 0.4,
             "duplicate_schema": 0.0, "label": 0},
        ]
        X, y = build_training_matrix(rows)
        assert X.shape == (3, 7)
        assert y.shape == (3,)
        assert X.dtype == np.float32
        assert y.dtype == np.int32

    def test_missing_keys_default_to_zero(self) -> None:
        rows = [
            {"label": 0},
            {"label": 1},
        ]
        X, y = build_training_matrix(rows)
        assert np.all(X == 0.0)  # all features default to 0
        assert y.tolist() == [0, 1]
