# T-015: Seeded RNG, aggregation and benchmark

Status: ready
Milestone: M2
Scenarios: SIM-012, SIM-013, CMP-005
Depends on: T-014

## Notes

- mulberry32 (or similar) seeded per run; RNG crit mode rolls per critable attack and uses the crit attack slot's windup (SIM-022).
- `simulateMany(scenario, { runs, seed })`: run i uses seed + i; report mean/p10/p50/p90 of TTK (not-killed handled explicitly) and total damage.
- CMP-005 benchmark: a Vitest bench or timed test over the 4×3×200 fixture with a 2 s budget; run in CI (allow headroom on slower runners; document the budget).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
