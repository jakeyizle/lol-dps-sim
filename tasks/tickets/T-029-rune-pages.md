# T-029: Rune pages and stat shards

Status: ready
Milestone: M5
Scenarios: RUNE-001, RUNE-002
Depends on: none

## Notes

- Verify shard rows and values against 26.22 first; shard rows aren't in Data Dragon's runesReforged, so add them to the data (manifest or override, with the source).
- `packages/engine/src/runes/`: `runeStats(page, champion, level)` and `runeEffects(page, owner)` (registry like items); pages are `{ primary, keystone, primaryRunes[3], secondary, secondaryRunes[2], shards[3] }`.
- Page validation (RUNE-001) is pure; the editor in `apps/web/src/ui/RuneEditor.tsx` uses it. BUILD-001's default page: decide one per kit (e.g. Jinx: Lethal Tempo) and put it with the kit.
- Level-scaling shards (health) scale per the shard's values.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
