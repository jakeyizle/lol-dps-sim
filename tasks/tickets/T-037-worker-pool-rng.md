# T-037: Worker pool, RNG mode, matrix benchmark

Status: ready
Milestone: M6
Scenarios: CMP-005, SIM-013
Depends on: T-036

## Notes

- Settings: crit mode expected/RNG + run count; RNG jobs aggregate with `many` (SIM-013: mean and spread shown in tables).
- Worker pool sized to `navigator.hardwareConcurrency` (cap 4); a job = one build × target × mode; cancel superseded jobs.
- CMP-005: engine benchmark test (4 builds × 3 targets × 200 RNG runs) under 2 s on CI; keep it in its own Vitest project/tag so it can be skipped locally.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green; deployed
