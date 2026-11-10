# T-004: Data pipeline — champion stats and attack data

Status: ready
Milestone: M1
Scenarios: DATA-002, DATA-003, DATA-006, DATA-010, DATA-011, DATA-012, DATA-013, DATA-014
Depends on: T-001, T-002

## Notes

- `packages/data-pipeline`: manifest with the 5 MVP champions (they cover both windup formats). Fetch DDragon `versions.json` + `champion/<C>.json`, and CDragon `raw.communitydragon.org/<major.minor>/game/data/characters/<c>/<c>.bin.json`.
- In the bin, the `CharacterRecord` object holds `attackSpeedModifiable`, `attackSpeedRatioModifiable`, `critDamageMultiplier`, `basicAttack`, `extraAttacks` and `critAttacks`.
- Windup comes in two formats:
  - Jinx: `basicAttack.{mAttackCastTime, mAttackTotalTime}`.
  - Caitlyn, Ashe, Vayne: only `mAttackDelayCastOffsetPercent` (windup = 0.3 + offset).
  - Ashe also has `mAttackDelayCastOffsetPercentAttackSpeedRatio`, the windup modifier.
- Per-slot windup: Jinx's rocket attack is a separate spell (`JinxQAttack2`), and her crit attack has a different cast time.
- Unit-test normalization on saved fixture JSON (store under `packages/data-pipeline/test/fixtures/`, not fetched in tests).
- Output folder is `generated/<major.minor>/` (e.g. `16.22`).
- DATA-001 is completed by the items/runes ticket; this ticket writes champions only.

## Done when

- `pnpm data:update` writes `packages/data/generated/16.22/champions.json` with the 5 champions; listed scenarios have passing tagged tests
