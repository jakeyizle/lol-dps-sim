# T-047: Mutation audit: engine

Status: in-progress
Milestone: M9
Scenarios: — (PLAN §8)
Depends on: T-046

## Notes

- Full `pnpm mutate` over the engine; kill survivors with tests tied to scenarios (add a scenario first when behaviour isn't specified), or disable equivalent ones inline with a reason (float `<`/`<=`, rounding).
- Record the before/after mutation score in LOG.

## Progress

- Baseline (first full run, before any audit): 76.41% (2322 killed, 13 timeout, 580 survived, 141 no coverage of 3116).
- Noise ignorer: effect/buff `id` and damage `source` labels (never read by logic), `at(…)` error labels, `RangeError` messages; the benchmark skips itself under instrumentation.
- Done: core/calc, damage, effects, many, queue, rng, rotation, stats (98%+, remaining disabled with reasons).
- Left: core/sim.ts, champions/*, items/*, runes/*, target.ts, metrics.ts, build.ts, champions/index.ts (no coverage: KITS/DEFAULT_RUNES only used by web tests).

## Done when

- No undocumented survivors in the engine; lint, typecheck, scenarios:check --strict green
