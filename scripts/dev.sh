#!/usr/bin/env bash
# =============================================================================
# Bring up the local dev stack (alias of `make dev`).
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up --build
