# T-020: Item effects, batch 1, and the MVP item list

Status: ready
Milestone: M3
Scenarios: ITEM-004, ITEM-011, ITEM-012, ITEM-005, ITEM-006, ITEM-007, ITEM-008
Depends on: T-016

## Notes

- Verify first: in 26.22 Kraken Slayer procs every 3rd attack (`AttackCount` 3, damage by level, missing-health bonus, `RangedDamageMultiplier` 0.8), with no max-stacks spend. Rewrite ITEM-004/011/012 to match before coding.
- `packages/engine/src/items/`: one file per item; values from `ItemData.values` / `calculations`; register required keys (DATA-012).
- IE (ITEM-006) and LDR (ITEM-007) look stats-only in 26.22; confirm and test them through the stat pipeline.
- Decide the MVP item list (filter the patch's items by tag, review by hand), update `manifest.ts`, regenerate data, and add scenarios for the batch 2/3 items named in `scenarios/items.md`.

## Done when

- Listed scenarios have passing tagged tests; MVP list in the manifest; batch 2/3 scenarios written; lint, typecheck, scenarios:check green
