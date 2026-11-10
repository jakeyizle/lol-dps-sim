# LoL DPS Sim

- Spec: `PLAN.md`. Requirements: `scenarios/*.md` (source of truth). Work: `tasks/ROADMAP.md` (process + tickets).
- Keep docs minimal; don't add new doc files.
- Game numbers live in patch data, never hardcoded in engine code or scenarios (PLAN §1).

## Commits

- Subject line only, imperative, ≤ 60 chars. No body.
- Ticket work: `T-012: add Kraken Slayer effect`. Otherwise: `fix typo in damage scenarios`.
- Only exception: one short body line when the "why" is non-obvious.

## Shipping

- Never push to `main`; it deploys to production. Branch (e.g. `t-012-kraken-slayer`), push, open a PR.
- Wait for all checks, then `gh pr merge --rebase --delete-branch` (keeps history linear).
- Don't stack PRs: rebase-merge rewrites SHAs, so every PR above a merged one conflicts. Branch each ticket from `main` after the previous PR merges; if work must continue while a PR waits, keep committing on the same branch/PR.
