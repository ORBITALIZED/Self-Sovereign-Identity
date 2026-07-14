# 🤝 Contributing

We welcome PRs of any size! Here's how to get started.

---

## Code of conduct

Be kind, be inclusive, be technical. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

---

## Project layout reminder

This is a **poly-repo-style monorepo**. Every subfolder in `packages/` or `apps/` is intended to be splittable into its own git repository. Look for:

- `README.md` at the top of every package — describes that package in isolation
- A meaningful `Makefile` / `package.json` / `Cargo.toml` / `foundry.toml` per package
- Cross-package imports go through the SDK (`packages/sdk`) — never import across `apps/`

---

## Branching model

| Branch      | Purpose                  |
| ----------- | ------------------------ |
| `main`      | Always deployable        |
| `feature/*` | New features (PR target) |
| `fix/*`     | Bug fixes                |
| `docs/*`    | Documentation only       |

Use **conventional commits** (`feat:`, `fix:`, `docs:`, `refactor:`).

---

## Style

| Language           | Linter / Formatter              |
| ------------------ | ------------------------------- |
| TypeScript / React | ESLint + Prettier (root config) |
| Rust               | `cargo fmt` + `cargo clippy`    |
| Solidity           | `forge fmt` + `solhint`         |
| Python             | `ruff` + `black`                |
| Circom             | `circom --inspect`              |

Run `make format` before every commit.

---

## Tests

Every package MUST ship tests. Add new tests next to the code you change.

```bash
make test                       # everything
pnpm --filter @ssi/sdk test     # single package
```

CI will block merge if:

- Tests fail
- Coverage drops below **70%**
- Lint fails

---

## Adding a new package

1. Create a folder under `packages/` or `apps/`
2. Add `README.md`, package config, at least one source file with a TODO
3. Register the workspace in root `package.json#workspaces` (if TS / JS)
4. Update `docker-compose.yml` if it's a service
5. Add a one-line entry to root `README.md#repository-layout`

---

## Pull request template

When opening a PR, include:

```markdown
## Summary
<!-- One sentence on what this PR does. -->

## Motivation
<!-- Why is this change needed? Link issues if applicable. -->

## Test plan
<!-- How did you verify this change? List commands or describe manual steps. -->
- [ ] CI passes locally (`make ci`)
- [ ] New tests added for new behaviour
- [ ] Manual smoke test performed

## Checklist
- [ ] I have run `make format`
- [ ] I have added/updated tests
- [ ] I have updated CHANGELOG.md
- [ ] This PR targets `main` from a `feature/*` / `fix/*` branch
```

---

## Release process (maintainers)

1. Ensure `CHANGELOG.md` has a dated `[Unreleased]` entry summarising all
   merged PRs since the last tag.
2. Bump the SDK version in `packages/sdk/package.json` if any SDK-facing
   API changed. Follow semver.
3. Tag the release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
4. Push the tag: `git push origin vX.Y.Z`
5. CI will publish `@ssi/sdk` to npm on tag push.

---

## Security disclosures

Email **security@ssi.example** — do **not** file a public GitHub issue.

---

## Known upstream issues (local drafts only)

Drafts for upstream trackers live in `docs/upstream-issue-drafts/`.
They are **not** auto-filed — file from your own GitHub identity if/when you take them public.

| Draft                                                               | Upstream repo            | What it anchors on                                       |
| ------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| `docs/upstream-issue-drafts/rs-stellar-xdr-arbitrary-regression.md` | `stellar/rs-stellar-xdr` | bug-origin: `#[derive(Arbitrary)]` calls `try_size_hint` |
| `docs/upstream-issue-drafts/rs-soroban-sdk-arbitrary-regression.md` | `stellar/rs-soroban-sdk` | consumer-side: 20.0.0 `cargo test` regression            |
