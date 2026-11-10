# T-027: Results for one build vs a dummy

Status: ready
Milestone: M4
Scenarios: METRIC-006, METRIC-010 (UI), TGT-002 (editor)
Depends on: T-024, T-026

## Notes

- Dummy target editor (health, armor, MR; TGT-002).
- Results: TTK (or "not killed" + remaining health), DPS window table, cumulative damage curve, breakdown, event log table (time, source, pre/post, crit flag incl. "averaged", active buffs).
- Chart: pick one small library (e.g. `uplot` or `recharts`) and use it for all later charts; record the choice in PLAN §3.
- E2E: create a Jinx build, add an item, see TTK change.

## Done when

- Listed scenarios have passing tagged tests; one E2E journey passes; deployed
