# T-035: Item-count timeline

Status: ready
Milestone: M6
Scenarios: CMP-002, CMP-003, CMP-010
Depends on: T-034

## Notes

- Model: `timelineSteps(build, levels?)` → builds with the first k items, per-step level (default build level), ranks from `abilityRanks` at that level — ignore the build's edited ranks when the step's level differs (CMP-010).
- Metric picker (TTK or a DPS window); each step shows the metric and `totalGold` of its items.
- Chart: one line per build over steps (small multiples if > 4 builds); table fallback.
- Jobs: k per build through the Runner; mind debounce and staleness per step.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
