# T-016: Effect interface and shared helpers

Status: ready
Milestone: M3
Scenarios: SIM-024, ITEM-001, ITEM-008
Depends on: none

## Notes

- `packages/engine/src/core/effects.ts`: `Effect` with the PLAN §6 hooks (`init`, `modifyStats`, `onAttackLaunch`, `onHit`, `onAbilityCast`, `modifyOutgoing`, `modifyIncoming`, `onDamageDealt`). Hooks get a context: time, stats, target health and max health, `deal`, `addBuff`, `buffStacks`, `schedule`.
- `SimAttacker.effects` replaces the ad-hoc `SimAbility.buff/dot/damage` plumbing. Keep `SimAbility` as the cast descriptor (cast time, cooldown, cost, reset) and move its payload into an `onAbilityCast` effect.
- On-hit damage is its own instance (`onHit: true`, not critable), dealt after the attack instance when it lands.
- Helpers: `everyNthAttack`, `stackingBuff`, `empoweredAttack` (next attack modified); AA resets stay on `SimAbility.resetsAttack`.
- Order: kit → items (build order) → runes (page order), as one array the caller builds in that order.

## Done when

- Listed scenarios have passing tagged tests; existing sim tests still pass; lint, typecheck, scenarios:check green
