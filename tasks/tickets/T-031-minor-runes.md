# T-031: Minor runes

Status: ready
Milestone: M5
Scenarios: RUNE-007, RUNE-008, RUNE-014, RUNE-015, RUNE-009, RUNE-010
Depends on: T-029

## Notes

- Verify each against 26.22 first. Cut Down needs the attacker's max health vs the target's; Last Stand / Absolute Focus use `attackerHealthFraction`; Gathering Storm uses `gameTime`.
- Legend: Alacrity stacks are long-term (SIM-010): stack input in the editor (BUILD-007) via the same mechanism as items.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
