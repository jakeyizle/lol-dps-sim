# T-030: Keystones

Status: ready
Milestone: M5
Scenarios: RUNE-003, RUNE-011, RUNE-012, RUNE-013, RUNE-004, RUNE-005, RUNE-006
Depends on: T-029

## Notes

- Verify each keystone's scenario against 26.22 values and the wiki before coding (PLAN §1); values from `RuneData.values`, gaps as overrides with sources.
- Lethal Tempo: stacks lift the AS cap (BuffSpec `attackSpeedCap`), decay one at a time (`decayOneAtATime`, with the rune's decay interval), bolt uses bonus AS including above the cap.
- Press the Attack: consecutive-hit counter on the target; "exposed" is an amp via `modifyOutgoing`.
- Hail of Blades: buff granted at `init`, consumed per attack, lifts the cap.
- Conqueror: adaptive force → AD for the MVP champions (adaptive picks the higher bonus of AD/AP).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
