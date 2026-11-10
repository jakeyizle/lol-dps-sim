# T-005: Engine stats

Status: ready
Milestone: M2
Scenarios: STAT-001, STAT-002, STAT-003, STAT-004, STAT-005, STAT-007, STAT-009, STAT-010
Depends on: T-001

## Notes

- `packages/engine/src/core/stats.ts`: pure functions from (champion data, constants, level, flat bonuses) → `StatBlock` with base/bonus split.
- Per-level bonus attack speed uses the same growth formula as other stats (STAT-001) and counts as bonus AS for STAT-004.
- The attack speed cap and crit multiplier come from inputs (constants / champion data), never literals in engine code.
- Test with fixture champions using round numbers, not live data (PLAN §8). Check one case by hand against the wiki's example for a real champion.
- STAT-006 and STAT-008 need the buff system; leave for that ticket.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
