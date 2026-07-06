# =============================================================================
# Self-Sovereign Identity — Root Makefile
# Each `subsystem/*` target delegates to its own package.
# =============================================================================
SHELL := /bin/bash
.DEFAULT_GOAL := help

# -------- toolchain versions -----------------------------------------------
NODE_VERSION   := 20
PNPM_VERSION   := 8
RUST_VERSION   := 1.79.0
FOUNDRY        := foundryup
CIRCOM_VERSION := 2.1.6

# -------- color helpers ----------------------------------------------------
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RESET  := \033[0m

# -------- help ------------------------------------------------------------
.PHONY: help
help: ## Show all targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# -------- core flow --------------------------------------------------------
.PHONY: bootstrap
bootstrap: ## Install all toolchains (Rust, Foundry, Circom) and JS deps
	@echo "$(YELLOW)→ Installing JS workspace dependencies…$(RESET)"
	pnpm install
	@echo "$(YELLOW)→ Installing Rust ($(RUST_VERSION))…$(RESET)"
	@if ! command -v rustup >/dev/null; then \
		curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain $(RUST_VERSION); \
	fi
	rustup target add wasm32-unknown-unknown --toolchain $(RUST_VERSION)
	@echo "$(YELLOW)→ Installing Foundry…$(RESET)"
	@if ! command -v forge >/dev/null; then \
		curl -L https://foundry.paradigm.xyz | bash && $(FOUNDRY); \
	fi
	@echo "$(YELLOW)→ Installing Circom ($(CIRCOM_VERSION))…$(RESET)"
	@if ! command -v circom >/dev/null; then \
		bash scripts/install-circom.sh $(CIRCOM_VERSION); \
	fi
	@echo "$(GREEN)✓ Bootstrap complete$(RESET)"

.PHONY: dev
dev: ## Spin up the full local stack
	@echo "$(YELLOW)→ Starting local stack…$(RESET)"
	docker compose up --build

.PHONY: build
build: ## Build everything (Soroban wasm + foundry + all TS packages)
	@echo "$(YELLOW)→ Building Soroban contracts…$(RESET)"
	$(MAKE) -C packages/contracts-stellar build
	@echo "$(YELLOW)→ Building Solidity contracts…$(RESET)"
	cd packages/contracts-evm && forge build
	@echo "$(YELLOW)→ Building all JS/TS packages (via turbo)…$(RESET)"
	pnpm build

.PHONY: test
test: ## Run the entire test matrix
	pnpm test
	$(MAKE) -C packages/contracts-stellar test
	cd packages/contracts-evm && forge test -vv

.PHONY: lint
lint: ## Lint everything
	pnpm lint

.PHONY: clean
clean: ## Purge build artifacts
	pnpm clean
	$(MAKE) -C packages/contracts-stellar clean
	rm -rf packages/contracts-evm/{cache,out,broadcast}
	rm -rf packages/zk-circuits/build

.PHONY: format
format: ## Auto-format the codebase
	pnpm format

# -------- subsystem shortcuts --------------------------------------------
.PHONY: stellar
stellar: ## Work on the Soroban contracts only
	$(MAKE) -C packages/contracts-stellar

.PHONY: evm
evm: ## Work on the EVM contracts only
	cd packages/contracts-evm && $(MAKE)

.PHONY: zk
zk: ## Work on the ZK circuits only
	cd packages/zk-circuits && bash scripts/compile.sh

.PHONY: deploy
deploy: ## Deploy all contracts to configured networks (stages: stellar → evm)
	./scripts/deploy-all.sh

.PHONY: docs
docs: ## Build & open the docs
	@echo "Docs are markdown in ./docs — open them in your editor."
