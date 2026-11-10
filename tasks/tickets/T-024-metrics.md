# T-024: Metrics from the trace, and the DPS run

Status: ready
Milestone: M4
Scenarios: METRIC-001, METRIC-002, METRIC-003, METRIC-004, METRIC-005, METRIC-007, METRIC-008, METRIC-009, METRIC-010
Depends on: none

## Notes

- `packages/engine/src/metrics.ts`: pure functions over `SimResult` (TTK, remaining health, DPS windows, cumulative curve, breakdown by type and source).
- DPS run (PLAN §6): `simulate(..., { dpsRun: true })` lets health fall below 0, caps missing-health reads at 100% (`EffectContext.targetHealth` clamped for effects), and turns executes off (attacker `executeBelow`, item executes). Revive / stasis don't exist yet (M5); leave a hook.
- `analyze(attacker, target, opts)` runs both: normal run for TTK, DPS run for windows; returns one result object the UI and worker use.
- Trace entries record the attacker's active buff ids for the event log (METRIC-006 UI in T-027).
- METRIC-007 final stats = `computeStats` at fight start for the build; expose from `analyze`.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
