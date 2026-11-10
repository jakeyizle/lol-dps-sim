# T-046: Stryker on the engine + mutate:changed

Status: ready
Milestone: M9
Scenarios: — (PLAN §8)
Depends on: T-045

## Notes

- Port from ../mmr-groups/scripts: `mutate.ts`, `mutate-changed.ts`, `stryker-coverage.ts`, `stryker-noise.ts` (+ tests), adapted to the pnpm workspace and Vitest projects.
- Stryker config for `packages/engine/src` (vitest runner, per-test coverage); `pnpm mutate` full run, `pnpm mutate:changed` limited to lines changed against `main`.
- PR job: `mutate:changed` fails on survivors on changed lines; equivalent mutants are disabled inline with a reason (`// Stryker disable next-line …: reason`).

## Done when

- `pnpm mutate:changed` runs in CI on PRs; lint, typecheck green
