# T-040: Kai'Sa

Status: ready
Milestone: M7
Scenarios: KAISA-001, KAISA-002, KAISA-003, KAISA-011, KAISA-012, KAISA-004, KAISA-005, KAISA-008, KAISA-009, KAISA-006, KAISA-010, KAISA-007
Depends on: T-039

## Notes

- Verify every scenario against 26.22 data and the wiki first (PLAN §1); cast times are 0 in the game file for most spells (see Caitlyn/Ashe overrides).
- Plasma: target-side stacks tracked on Kai'Sa's side (like Ashe's Frost); rupture at max stacks deals % missing health — use `targetMaxHealth − targetHealth`.
- Evolutions are thresholds on stats (bonus AD, AP, bonus AS incl. level growth?) — check which stat each uses; an evolved ability changes values, not just a flag.
- E: charge time shortens with bonus AS (castTime as a function of stats, like Jinx W); attacks reduce E's cooldown via `reduceCooldowns`.
- W refund on hit: `reduceCooldowns(["W"], fraction)` right after the cast.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
