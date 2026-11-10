# T-032: Champion targets, overrides and presets

Status: ready
Milestone: M5
Scenarios: TGT-001, TGT-012, TGT-003, TGT-004, TGT-005, TGT-002, BUILD-009
Depends on: T-029

## Notes

- Target model: `{ kind: "champion", champion, level, items, runes, overrides } | { kind: "dummy", health, armor, magicResist, damageReduction }`; any champion in the patch data can be a target (BUILD-009 second half). Target champions outside the manifest need their stats in the data: decide whether to add all champions' base stats to the pipeline (stats only, no kits).
- Target stats via `computeStats` + item/rune stats; bonus health feeds Giant Slayer (ITEM-013).
- TGT-002: add the dummy's % damage reduction (a `DamageReduction` on the defender).
- Presets: Squishy / Bruiser / Tank shipped as data; user presets in the store (persistence lands in M8, so TGT-005's reload half waits for SAVE-001; note it).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
