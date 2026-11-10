# T-009: Ability values

Status: ready
Milestone: M1
Scenarios: DATA-004
Depends on: T-004

## Notes

- From each champion bin's `SpellObject`s named in `CharacterRecord.spellNames` (Q/W/E/R) and the passive: `mSpell.mDataValues` (`{ name, values[7] }`, index 0 = rank 0), `cooldownTime`, `mana`, `mCastTime`, `maxLevels`.
- Store `abilities.{Q,W,E,R}: { maxRank, cooldown[], cost[], castTime, values: Record<name, number[]> }` and `passive.values` (passives often scale per level: keep all 7 values, documented).
- Spell calculations (`mSpellCalculations`) hold ratios; store raw for now, decide a normalized form when the first kit (Jinx) needs it.
- Keep fixtures trimmed to the spell objects the tests use.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
