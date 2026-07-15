#!/usr/bin/env bash
# =============================================================================
# setup-branch-protection.sh
# Configures branch protection rules on `main` via the GitHub API so the CI
# gating pattern is enforced at the repo level — no merge without passing CI.
#
# Prerequisites:
#   - GitHub CLI (`gh`) installed and authenticated:  gh auth login
#   - Admin access to the repository
#
# Usage:
#   ./scripts/setup-branch-protection.sh [owner] [repo]
#
#   Defaults: owner=ORBITALIZED  repo=Self-Sovereign-Identity
# =============================================================================

set -euo pipefail

# -------------------------------------------------------------------------
# Prerequisites
# -------------------------------------------------------------------------
if ! command -v gh &>/dev/null; then
  echo "ERROR: GitHub CLI (gh) is not installed." >&2
  echo "       Install: https://cli.github.com" >&2
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "ERROR: gh is not authenticated." >&2
  echo "       Run: gh auth login" >&2
  exit 1
fi

OWNER="${1:-ORBITALIZED}"
REPO="${2:-Self-Sovereign-Identity}"

echo "==> Configuring branch protection for $OWNER/$REPO (main) …"

# Required status checks — these are the job names from the CI workflows.
# When any of these fail or are skipped, merging is blocked.
REQUIRED_CHECKS=(
  "Formatting — Prettier Check"
  "Python — Ruff Lint"
  "Rust — Format Check"
  "JS/TS — Lint & Test"
  "Solidity — Forge Build & Test"
  "Python — AI Fraud Service"
  "Rust — Clippy & Check"
)

# Build the JSON array of required contexts
CHECKS_JSON="["
for i in "${!REQUIRED_CHECKS[@]}"; do
  CHECKS_JSON+="\"${REQUIRED_CHECKS[$i]}\""
  if [ "$i" -lt "$((${#REQUIRED_CHECKS[@]} - 1))" ]; then
    CHECKS_JSON+=", "
  fi
done
CHECKS_JSON+="]"

# ---------------------------------------------------------------------------
# Apply branch protection via the GitHub REST API.
# Docs: https://docs.github.com/en/rest/branches/branch-protection
# ---------------------------------------------------------------------------
gh api "repos/$OWNER/$REPO/branches/main/protection" \
  --method PUT \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": $CHECKS_JSON
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": false,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF

echo ""
echo "✅ Branch protection enabled on main."
echo "   Required checks: ${REQUIRED_CHECKS[*]}"
echo "   Branches must be up-to-date before merging."
