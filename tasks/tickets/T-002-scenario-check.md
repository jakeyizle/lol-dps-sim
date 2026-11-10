# T-002: Scenario parser, check and Vitest tags

Status: ready
Milestone: M0
Scenarios: none (PLAN §1)
Depends on: T-001

## Notes

- Port `scripts/scenarios.ts`, `scripts/scenarios.test.ts` and `scripts/check-scenarios.ts` from `../mmr-groups` as-is; adjust `SKIP_DIRS` (no `.wrangler`).
- Root `vitest.config.ts` with `test.tags: scenarioTags()` and projects `engine`, `scripts` (add `data`, `web` later).
- Add `scenarios:check` script. Without `--strict` it should report all scenarios uncovered, with 0 errors.

## Done when

- A test tagged with an unknown ID fails; `pnpm scenarios:check` prints the scenario count with 0 errors
