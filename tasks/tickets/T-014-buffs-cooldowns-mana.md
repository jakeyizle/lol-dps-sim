# T-014: Buffs, DoTs, cooldowns and mana

Status: ready
Milestone: M2
Scenarios: STAT-006, STAT-008, SIM-003, SIM-004, SIM-005, SIM-006, SIM-009, SIM-010, SIM-014, SIM-015, SIM-018, SIM-019, SIM-020, SIM-021
Depends on: T-007

## Notes

- Buff primitive in the loop: `{ id, stacks, maxStacks, duration, refreshOnStack, stats? }`, expiry scheduled as events; stats recomputed when buffs change (`computeStats` with buff bonuses + cap override).
- Abilities as minimal test doubles until the effect system (M3): cast time, cooldown with haste, cost, AA reset flag, damage instance. A temporary fixed action list drives tests; the rotation engine replaces it in M3.
- Mana: start at max, regen per second from per-5 stat, costs on cast.
- DoT: periodic damage events with tick interval and duration.
- Long-term stacks: initial buff state passed in from the build.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
