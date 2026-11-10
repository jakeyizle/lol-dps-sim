# T-034: Builds side by side

Status: ready
Milestone: M6
Scenarios: CMP-001, CMP-009
Depends on: T-033

## Notes

- Results for every build in `compared` against the current target, one Runner job per build (reuse `useAnalysis`' staleness per build; CMP-006/CMP-011 must keep holding).
- One table: rows = metrics (TTK, DPS windows, breakdown by source), columns = builds; best per row marked with text weight + a "best" label, not colour alone (dataviz skill).
- Shared chart: extend `DamageChart` to several series (categorical palette in fixed order, validated light/dark, legend + direct labels ≤ 4) and a horizontal line at effective health (health + shields; label it).
- Single-build view becomes the one-column case; keep the event log per build (selectable).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
