# T-048: Web logic in mutation scope + audit

Status: in-progress
Milestone: M9
Scenarios: — (PLAN §8)
Depends on: T-047

## Notes

- Add `apps/web/src/model/**` and `apps/web/src/ui/useAnalysis.ts` to Stryker's scope (jsdom tests run under Stryker's vitest runner); leave pure presentation components out.
- Audit survivors as in T-047.

## Progress

- Web model files are in Stryker's scope (`scripts/mutate.ts`). First run 69.25% over model + useAnalysis; persist.ts 58% → 93% with persist.edges.test.ts.
- Blocker to investigate: mutants in `ui/useAnalysis.ts` (e.g. `[build]` → `[]`) are reported Survived even with `coverageAnalysis: "all"` and `related: false`, yet the same edit made by hand fails results.test.tsx. Model mutants do activate. Until that's understood, useAnalysis.ts stays out of scope so CI can't fail on false survivors.
- Left: survivors in build, rotation, share, simulation, store, target (list from a `pnpm exec stryker run --mutate apps/web/src/model/<file>.ts` run).

## Done when

- No undocumented survivors in web logic; `mutate:changed` covers web; lint, typecheck green; deployed
