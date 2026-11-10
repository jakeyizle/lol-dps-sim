# T-017: Rotation rules and conditions

Status: ready
Milestone: M3
Scenarios: ROT-001, ROT-002, ROT-012, ROT-003, ROT-013, ROT-004, ROT-005, ROT-006
Depends on: T-016

## Notes

- `packages/engine/src/core/rotation.ts`: `Rule = { action, when?: Condition[] }`, conditions as tagged data (`targetHealthBelow`, `wouldKill`, `minStacks`, `afterAttack`, `minMana`) so the UI and URLs can carry them (PLAN §6).
- Replace `Policy` with a rotation evaluator. ROT-002's wake-up: earliest `availableAt` over rules whose conditions hold; when conditions depend on state, re-decide after any state-changing event.
- `wouldKill`: expected-value post-mitigation damage of the action vs. current health + shields, via an `estimate` on the ability descriptor.
- Per-champion supported actions and conditions (ROT-009) land with the rotation editor (M7).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
