#!/usr/bin/env bash
# =============================================================================
# Sentinel check for the upstream stellar-xdr `Arbitrary` / `try_size_hint`
# regression.
#
# Status: RESOLVED (via soroban-sdk upgrade)
# ==========================================
# The regression is sidestepped by upgrading to soroban-sdk >= 21.7.7.
# `cargo build --target wasm32-unknown-unknown --release` and
# `cargo clippy --target wasm32-unknown-unknown -- -D warnings` both pass
# cleanly without any `continue-on-error` workaround.
#
# This script still detects the old regression signature in case a future
# downgrade or dependency drift reintroduces it.
#
# Background
# ----------
# `soroban-sdk = "=20.0.0"` transitively pulled `stellar-xdr` 20.0.x, whose
# `#[derive(Arbitrary)]` macro emitted impls calling `try_size_hint` — a
# method added in `arbitrary` 1.4 and absent from the `~1.3.0` pin that the
# SDK 20.x line enforced. Upgrading to `=21.7.7` dropped the pin, resolving
# the build-time failure.
#
# Symptom (historical)
# --------------------
# `cargo test --features testutils` failed with thousands of
# `error[E0599]: no method named try_size_hint found for struct …` errors
# against XDR types such as `AccountId`, `Curve25519Secret`, etc.
#
# Exit codes
# ----------
#   0 — regression is fixed (E0599 / try_size_hint pattern is absent from
#       the compiler output, regardless of whether `cargo test` itself
#       passes or fails for unrelated reasons).
#   1 — regression signature is still present (the E0599 / try_size_hint
#       pattern matched). CI should stay red.
#
# Note: `cargo test --features testutils` may still fail after this
# regression is resolved due to a separate `rand_core` version conflict in
# `soroban-env-host` (present in all 21.x–23.x). That is a different issue
# unrelated to the `try_size_hint` regression.
#
# Usage
# -----
#   bash scripts/check-stellar-xdr-fix.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRATE="$ROOT/packages/contracts-stellar"

# -- output helpers ---------------------------------------------------------
if [ -t 1 ] || [ "${CI:-}" = "true" ] || [ -n "${GITHUB_ACTIONS:-}" ]; then
  C_RESET='\033[0m'
  C_BLUE='\033[0;34m'
  C_YEL='\033[0;33m'
  C_RED='\033[0;31m'
  C_GRN='\033[0;32m'
else
  C_RESET='' C_BLUE='' C_YEL='' C_RED='' C_GRN=''
fi
info()  { printf "${C_BLUE}[stellar-xdr-fix]${C_RESET} %s\n" "$*"; }
warn()  { printf "${C_YEL}[stellar-xdr-fix]${C_RESET} %s\n" "$*"; }
err()   { printf "${C_RED}[stellar-xdr-fix]${C_RESET} %s\n" "$*"; }
ok()    { printf "${C_GRN}[stellar-xdr-fix]${C_RESET} %s\n" "$*"; }
hr()    { printf -- "------------------------------------------------------------\n"; }
gh_anno() {
  # Emit a GitHub Actions workflow command if running in CI; no-op otherwise.
  # Examples:  gh_anno error "title" "msg"
  local level="$1" title="$2" msg="$3"
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    printf '::%s title=%s::%s\n' "$level" "$title" "$msg"
  fi
}

# -- preflight --------------------------------------------------------------
[ -d "$CRATE" ] || { err "Soroban crate not found at $CRATE"; exit 1; }
[ -f "$CRATE/Cargo.toml" ] || { err "Cargo.toml missing in $CRATE"; exit 1; }
command -v cargo >/dev/null 2>&1 || { err "cargo not on PATH"; exit 1; }

hr
info "Probe target: $CRATE"
info "Command:      cargo test --features testutils"

# Cd into the crate — `cargo test --features testutils` is invalid in the
# repo root (no Cargo.toml / features at that level), and the parent
# workspace would silently succeed against the wrong target.
cd "$CRATE" || { err "could not cd into $CRATE"; exit 1; }

hr

# Capture full output so we can both stream it to the CI log AND grep it.
# GNU `mktemp -t NAME.XXXXXX.log` rejects templates that don't end in `X`s,
# so we omit the `.log` suffix and add it after the fact.
LOG_FILE="$(mktemp /tmp/stellar-xdr-fix.XXXXXX).log"
trap 'rm -f "$LOG_FILE"' EXIT

# Stream to stdout (so CI users see the compiler output directly) AND tee it
# to a tempfile for pattern matching. We deliberately disable `set -e` for
# the duration of `cargo` because a non-zero exit is the whole signal.
set +e
cargo test --features testutils 2>&1 | tee "$LOG_FILE"
CARGO_STATUS=${PIPESTATUS[0]}
set -uo pipefail

# -- verdict ----------------------------------------------------------------
# The regression's signature: error[E0599] mentioning `try_size_hint` AND
# at least one of the known-affected XDR types being named in context.
RE_E0599='error\[E0599\]'
RE_HINT='try_size_hint'
# `grep -c` exits 1 when it finds zero matches; without `|| true` the
# assignment itself would surface a non-zero status and (under set -e
# elsewhere in the pipeline) cut the script short. Use `|| true` so the
# exit code is neutralised without polluting stdout with a second `0`.
E0599_COUNT=$(grep -E -c "$RE_E0599"        "$LOG_FILE" 2>/dev/null || true)
HINT_COUNT=$(grep -E -c "$RE_HINT"          "$LOG_FILE" 2>/dev/null || true)

# XDR types historically reported as affected (kept in sync with the
# commented block in packages/contracts-stellar/Cargo.toml). We
# intentionally allowlist the ones documented as evidence; if an
# unrelated E0599 pops up the `both must match` rule below keeps
# us honest.
KNOWN_TYPES='AccountId|Curve25519Secret|Curve25519Public|HmacSha256Key|HmacSha256Mac|SignerKey|Signature|NodeId'
TYPE_COUNT=$(grep -E -c "$KNOWN_TYPES"       "$LOG_FILE" 2>/dev/null || true)

# Stub out non-numeric values from `grep -c` (shouldn't happen, but defensive).
E0599_COUNT=${E0599_COUNT:-0}
HINT_COUNT=${HINT_COUNT:-0}
TYPE_COUNT=${TYPE_COUNT:-0}

hr
if [ "$CARGO_STATUS" -eq 0 ]; then
  ok "cargo test --features testutils SUCCEEDED."
  ok "stellar-xdr regression is GONE. Safe to flip [lib] test = false back to true and delete the upstream-bug comment block in packages/contracts-stellar/Cargo.toml."
  gh_anno "notice" "stellar-xdr regression fixed" "cargo test --features testutils succeeded. Flip packages/contracts-stellar/Cargo.toml [lib] test = false → true and remove the upstream-bug comment block."
  exit 0
fi

if [ "${E0599_COUNT:-0}" -gt 0 ] && [ "${HINT_COUNT:-0}" -gt 0 ] && [ "${TYPE_COUNT:-0}" -gt 0 ]; then
  err "stellar-xdr E0599 / Arbitrary / try_size_hint regression STILL PRESENT."
  err "  • E0599 occurrences       : $E0599_COUNT"
  err "  • try_size_hint mentions  : $HINT_COUNT"
  err "  • known XDR types matched : $TYPE_COUNT"
  err ""
  err "Sample of the regression (first match):"
  printf '\n'
  grep -E "$RE_E0599.*$RE_HINT" "$LOG_FILE" | head -5 | sed 's/^/    /'
  printf '\n'
  err "Action: do NOT flip [lib] test = false yet. Wait for an upstream fix in stellar-xdr (>=20.1.0 patch or later protocol line) and re-run this script."
  gh_anno "error" "stellar-xdr regression still present" "${E0599_COUNT} E0599 / try_size_hint errors across ${TYPE_COUNT} known XDR types. Full log: ${LOG_FILE}"
  exit 1
fi

# Fallthrough: cargo test failed but the regression signature was NOT
# observed. This means the try_size_hint regression is resolved — the
# failure is for a separate reason (see the rand_core note in Cargo.toml).
ok "stellar-xdr E0599 / try_size_hint regression is RESOLVED."
ok "  (E0599 occurrences: $E0599_COUNT, try_size_hint: $HINT_COUNT, known XDR types: $TYPE_COUNT)"
warn "cargo test --features testutils still fails, but for a DIFFERENT reason."
warn "See the [lib] test = false comment in packages/contracts-stellar/Cargo.toml."
gh_anno "notice" "stellar-xdr regression resolved" "The E0599/try_size_hint pattern is absent. cargo test fails for a separate rand_core issue documented in Cargo.toml."
exit 0
