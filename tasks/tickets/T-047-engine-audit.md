# T-047: Mutation audit: engine

Status: ready
Milestone: M9
Scenarios: — (PLAN §8)
Depends on: T-046

## Notes

- Full `pnpm mutate` over the engine; kill survivors with tests tied to scenarios (add a scenario first when behaviour isn't specified), or disable equivalent ones inline with a reason (float `<`/`<=`, rounding).
- Record the before/after mutation score in LOG.

## Done when

- No undocumented survivors in the engine; lint, typecheck, scenarios:check --strict green
