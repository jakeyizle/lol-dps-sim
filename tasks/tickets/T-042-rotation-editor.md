# T-042: Rotation editor

Status: ready
Milestone: M7
Scenarios: ROT-008, ROT-009, ROT-010
Depends on: T-041

## Notes

- Editor in the build: ordered rule list (add, remove, reorder), each rule an action plus conditions; only the kit's abilities and `attack` as actions, and only the `Condition` kinds as conditions, with buff choices from the kit's stack buffs (export a per-kit list of rotation-visible buffs).
- `Build.rotation` already overrides the kit's default; "Reset" sets it back to undefined.
- R-only-when-enabled (CAIT-005, ASHE-005) becomes reachable here.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green; deployed
