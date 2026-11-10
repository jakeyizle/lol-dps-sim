# T-011: Item and rune data

Status: ready
Milestone: M1
Scenarios: DATA-001, DATA-017
Depends on: T-004

## Notes

- Manifest gains `items` (ids) and `runes` (ids). Start with the items named in `scenarios/items.md` and PLAN §2 plus the target's defensive items in `scenarios/target.md`; the full MVP list is decided in the first item-effect ticket.
- Items: Data Dragon `item.json` for name, gold, flat stats; CommunityDragon `items.cdtb.bin.json` (game-version folder) for passive values (`mDataValues`) and stats Data Dragon lacks. Map stats to engine `StatBonuses` names (fractions for percents).
- Exclusive groups: from the item bin (look for unique-group fields); if absent, an override list naming Last Whisper, Lifeline, boots, with the source noted.
- Runes: CommunityDragon `perks.json` + perk bins for values; Data Dragon `runesReforged.json` for tree/slot structure (RUNE-001 needs it later).
- Writes `items.json` and `runes.json`; drift and required-values cover them (extend `missingValues` input to all entities).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
