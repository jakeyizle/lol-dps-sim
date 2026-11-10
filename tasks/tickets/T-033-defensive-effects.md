# T-033: Target defensive effects

Status: ready
Milestone: M5
Scenarios: TGT-006, TGT-007, TGT-008, TGT-013, TGT-014, TGT-009, TGT-010, TGT-011, TGT-015, METRIC-001, METRIC-009
Depends on: T-032

## Notes

- Verify each item against 26.22 first. Target-side effects run `modifyIncoming` and new target hooks (`onHealthBelow`, revive, stasis).
- Engine: untargetable windows (stasis, GA revive delay) drop incoming damage; timers keep running (TGT-015). TTK counts to the final death after a revive (METRIC-001).
- DPS run: revive and stasis off, low-health shields still trigger once (METRIC-009).
- Zhonya's activation health percent is a target setting with "never" (TGT-011).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green; deployed
