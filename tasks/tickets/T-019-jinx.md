# T-019: Jinx kit and default rotation

Status: ready
Milestone: M3
Scenarios: JINX-001, JINX-002, JINX-003, JINX-004, JINX-005, JINX-006, JINX-007, JINX-008, JINX-009, ROT-007
Depends on: T-016, T-017

## Notes

- Start by verifying `scenarios/jinx.md` against 26.22 (wiki + game file values): minigun stacks and decay, rocket bonus %, mana per rocket, W cast time formula, R missing-health % and max-damage range, and which attack slots minigun and rockets use.
- `packages/engine/src/champions/jinx.ts`: effects and abilities built from `ChampionData.abilities` values only; register required value keys in `required-values.ts` (DATA-012).
- Weapon swap is the `Q` action; minigun stacks are kept per Q's values.
- Accuracy fixtures (PLAN §8): at least two hand-calculated cases (±1%) on round-number fixture data, recorded with the patch.
- ROT-007 is met per champion; tag Jinx's default-rotation test with it.

## Done when

- Listed scenarios have passing tagged tests; accuracy fixtures pass; lint, typecheck, scenarios:check green
