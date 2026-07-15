"""Unit tests for the model registry."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.registry import ModelRegistry


@pytest.fixture
def registry(tmp_path: Path) -> ModelRegistry:
    return ModelRegistry(tmp_path / "models")


class TestModelRegistry:
    def test_list_models_initial(self, registry: ModelRegistry) -> None:
        assert registry.list_models() == []

    def test_get_active_initial(self, registry: ModelRegistry) -> None:
        assert registry.get_active() is None

    def test_register_and_list(self, registry: ModelRegistry) -> None:
        registry.register("fraud_v1", {"accuracy": 0.95, "samples": 100})
        models = registry.list_models()
        assert len(models) == 1
        assert models[0]["name"] == "fraud_v1"
        assert models[0]["accuracy"] == 0.95
        assert models[0]["samples"] == 100
        assert "created_at" in models[0]

    def test_register_replaces_previous(self, registry: ModelRegistry) -> None:
        registry.register("fraud_v1", {"accuracy": 0.90})
        registry.register("fraud_v1", {"accuracy": 0.95})
        models = registry.list_models()
        assert len(models) == 1
        assert models[0]["accuracy"] == 0.95

    def test_list_models_newest_first(self, registry: ModelRegistry) -> None:
        import time
        registry.register("v1", {"accuracy": 0.8})
        time.sleep(0.01)
        registry.register("v2", {"accuracy": 0.9})
        models = registry.list_models()
        assert models[0]["name"] == "v2"
        assert models[1]["name"] == "v1"

    def test_set_active_nonexistent(self, registry: ModelRegistry) -> None:
        ok = registry.set_active("fraud_nonexistent")
        assert ok is False

    def test_set_active_success(self, registry: ModelRegistry) -> None:
        registry.register("fraud_v1", {"accuracy": 0.95})
        ok = registry.set_active("fraud_v1")
        assert ok is True
        assert registry.get_active() == "fraud_v1"

    def test_set_active_overwrites_previous(self, registry: ModelRegistry) -> None:
        registry.register("v1", {"accuracy": 0.8})
        registry.register("v2", {"accuracy": 0.9})
        registry.set_active("v1")
        assert registry.get_active() == "v1"
        registry.set_active("v2")
        assert registry.get_active() == "v2"

    def test_get_returns_model_metadata(self, registry: ModelRegistry) -> None:
        registry.register("fraud_v1", {"accuracy": 0.95, "samples": 200})
        meta = registry.get("fraud_v1")
        assert meta is not None
        assert meta["accuracy"] == 0.95
        assert meta["samples"] == 200

    def test_get_nonexistent(self, registry: ModelRegistry) -> None:
        assert registry.get("nonexistent") is None

    def test_persistence_across_instances(self, registry: ModelRegistry) -> None:
        registry.register("fraud_v1", {"accuracy": 0.95})
        # Create a new registry pointing to the same directory
        registry2 = ModelRegistry(registry.models_dir)
        models = registry2.list_models()
        assert len(models) == 1
        assert models[0]["name"] == "fraud_v1"

    def test_active_persistence_across_instances(self, registry: ModelRegistry) -> None:
        registry.register("fraud_v1", {"accuracy": 0.95})
        registry.set_active("fraud_v1")
        registry2 = ModelRegistry(registry.models_dir)
        assert registry2.get_active() == "fraud_v1"
