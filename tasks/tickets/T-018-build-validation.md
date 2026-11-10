# T-018: Build validation

Status: ready
Milestone: M3
Scenarios: ITEM-002, ITEM-003, ITEM-010
Depends on: none

## Notes

- `packages/engine/src/build.ts`: `addItem(items, itemId, catalog)` → `{ ok: true, items } | { ok: false, reason }`; shared by attacker and target editors.
- Exclusive groups come from `ItemData.groups` (DATA-017). Boots are the `Boots` group, but ITEM-010's message names the boots already in the build.
- Test with fixture items, not the live patch.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
