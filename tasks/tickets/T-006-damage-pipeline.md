# T-006: Damage pipeline

Status: ready
Milestone: M2
Scenarios: DMG-001, DMG-002, DMG-003, DMG-004, DMG-005, DMG-006, DMG-007, DMG-008, DMG-009, DMG-010, DMG-011, DMG-012, DMG-013, DMG-014, DMG-015
Depends on: T-005

## Notes

- `packages/engine/src/core/damage.ts`: pure functions. `DamageInstance { type, amount, source, flags }` → resolved damage, given attacker `StatBlock`, target resistances/reductions/shields and crit mode.
- Order: raw → crit (EV or a supplied roll; on-hit excluded) → amps → effective resistance (flat reduction → % reduction → % pen → lethality, pen floors at 0) → resistance multiplier → target reductions → shields (typed) → health.
- RNG crit takes a boolean from the caller; seeded RNG lives in the event loop (later ticket).
- Shields are plain values here (`{ amount, blocks: "all" | DamageType }`); triggers and decay are target effects (M5).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
