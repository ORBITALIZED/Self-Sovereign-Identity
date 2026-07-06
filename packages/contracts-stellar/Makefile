# Soroban contracts — convenience wrapper around cargo + soroban CLI
PWD := $(shell pwd)

.PHONY: build
build: ## Compile every contract to wasm32
	cargo build --target wasm32-unknown-unknown --release

.PHONY: test
test: ## Run unit + integration tests with the testutils feature flag
	cargo test --features testutils

.PHONY: fmt
fmt:
	cargo fmt --all

.PHONY: clippy
clippy:
	cargo clippy --all-targets -- -D warnings

.PHONY: clean
clean:
	cargo clean

.PHONY: deploy
deploy: ## Deploy all wasm blobs (requires funded STELLAR_DEPLOYER_SECRET in env)
	@echo "→ Optimizing wasm…"
	@for f in target/wasm32-unknown-unknown/release/*.wasm; do \
		soroban contract optimize --wasm $$f; \
	done
	@echo "→ Deploying IdentityRegistry…"
	$(eval ID_ID := $(shell soroban contract deploy \
		--wasm target/wasm32-unknown-unknown/release/ssi_contracts_stellar.wasm \
		--source $(STELLAR_DEPLOYER_SECRET) \
		--network testnet))
	@echo "Deployed ID: $(ID_ID)"
	@echo "$(ID_ID)" > .soroban/identity_id
	@echo "Add to .env: STELLAR_IDENTITY_CONTRACT=$(ID_ID)"
