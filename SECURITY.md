# Security

This document describes how the Self-Sovereign Identity platform handles
security issues — how to report them, what is in-scope, and what we
consider out-of-scope.

## Reporting a vulnerability

**Email:** `security@ssi.example` (PGP key coming — for now use this
address and the team will respond within two business days).

Do **NOT** file a public GitHub issue for suspected vulnerabilities.
Public disclosure before a fix is deployed makes exploitation easier and
delays the response window.

Please include in your report:

1. A clear description of the issue.
2. Steps to reproduce, ideally with a runnable proof-of-concept
   (`forge test`, `cargo test`, a curl/script, or a small repo).
3. The commit hash or release tag you tested against.
4. An estimate of impact (financial loss, identity disclosure, …).

We follow a **90-day disclosure window**: after 90 days from the initial
report, the reporter is free to disclose publicly even if no fix has
shipped, unless we have negotiated an extension.

## Threat model

In-scope:

- Smart-contract bugs in `packages/contracts-evm` and
  `packages/contracts-stellar` that could lead to **lost funds**,
  **incorrect credential issuance**, or **unauthorised state changes**.
- API gateway bugs that could lead to **stolen credentials**,
  **unauthorised issuance**, or **data leakage**.
- IPFS / encryption service bugs that could leak encrypted
  credentials.
- Bridge relayer bugs that could lead to **double-wrapping**,
  **replay**, or **wrong recipient**.
- Front-end bugs that could leak wallet keys or sign unintended
  messages.

Out-of-scope (but please disclose anyway):

- Loss of funds due to a user losing their wallet seed.
- Phishing attacks against end-users (we don't run the marketing site).
- Best-practice improvements that don't have a direct security impact
  (Style nits, refactors, etc — please file a regular GitHub issue).

## Supported versions

| Component | Supported versions                                |
| --------- | ------------------------------------------------- |
| CLI / SDK | `@ssi/sdk` v0.1.x and current main                |
| EVM       | contracts in `packages/contracts-evm` on main     |
| Soroban   | contracts in `packages/contracts-stellar` on main |
| Services  | `apps/*` on main                                  |
| Frontend  | `apps/frontend` on main                           |

Older versions (anything tagged <= v0.0.x) are **not supported** and
will not receive backported patches.

## Past advisories

_None published yet._

When advisories are issued they will be linked under this heading with
a date, the affected versions, and a short summary. The fixes themselves
land in normal Git commits to `main` and the corresponding package
CHANGELOG files.

## Responsible publication

If you intend to publish a write-up (technical blog, conference talk,
paper) about a vulnerability you reported to us, please share it with
us at least **14 days** before the public release so we can coordinate
disclosure of the patch and ensure users can upgrade.
