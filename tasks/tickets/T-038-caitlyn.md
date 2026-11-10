# T-038: Caitlyn

Status: ready
Milestone: M7
Scenarios: CAIT-001, CAIT-002, CAIT-006, CAIT-003, CAIT-004, CAIT-005
Depends on: T-033

## Notes

- Verify every scenario against 26.22 data and the wiki first (PLAN §1); gaps become overrides with sources.
- Kit in `packages/engine/src/champions/caitlyn.ts` on the Jinx pattern: headshot counter via `everyNthAttack`, trap/net headshots as a buff consumed by the next attack, trap arm delay via `schedule`, Q/R as `SimAbility`. Register in `KITS` with a default rune page; add accuracy fixtures (hand-calculated, ±1%).
- Headshot crit scaling uses the game calculation (evaluator may need new parts).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
