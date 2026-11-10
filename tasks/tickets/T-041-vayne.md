# T-041: Vayne

Status: ready
Milestone: M7
Scenarios: VAYNE-001, VAYNE-002, VAYNE-006, VAYNE-003, VAYNE-007, VAYNE-004, VAYNE-005
Depends on: T-039

## Notes

- Verify every scenario against 26.22 first.
- Silver Bolts: every third hit on the target, true % max health with a minimum — `everyNthAttack` at hit; phantom hits (Guinsoo) count as hits.
- Q Tumble: empowered next attack (`empoweredAttack`) and an attack-timer reset (`resetsAttack` on the ability). R: AD buff and Tumble cooldown reduction while active (stats + cooldown multiplier).
- E: ability damage only (no wall stun in a 1v1 dummy fight).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
