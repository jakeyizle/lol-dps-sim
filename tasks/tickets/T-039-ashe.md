# T-039: Ashe

Status: ready
Milestone: M7
Scenarios: ASHE-001, ASHE-006, ASHE-007, ASHE-002, ASHE-003, ASHE-008, ASHE-009, ASHE-004, ASHE-005
Depends on: T-033

## Notes

- Verify every scenario against 26.22 first. Frost Shot: Ashe can't crit; bonus damage scales with crit chance (her attack becomes non-critable, like ITEM-029's `critable = false`).
- Focus stacks and Ranger's Focus flurry (extra attacks per attack, each applying on-hit per Q's values — ASHE-009) need a multi-hit attack: check whether `applyOnHit` (Guinsoo) covers it or the sim needs per-attack hit count.
- Slow state is target-side only for ASHE-007 (first attack unslowed).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
