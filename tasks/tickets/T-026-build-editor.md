# T-026: Build editor and stats panel

Status: ready
Milestone: M4
Scenarios: BUILD-007, BUILD-008, BUILD-009, ITEM-002, ITEM-003, ITEM-010, METRIC-007
Depends on: T-025

## Notes

- Build list (add / duplicate / rename / delete) and the editor: champion picker (attackers: kits only, BUILD-009), level, skill ranks, item slots with search (validation messages from `addItem`), long-term stack inputs only for relevant items/passives (BUILD-007), attacker health, settings.
- Stats panel from `computeStats` with the METRIC-007 list; updates on every change.
- Component tests with Testing Library; tag the UI-facing ITEM-002/003/010 tests (messages shown).
- Keep it plain Tailwind; no component library.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
