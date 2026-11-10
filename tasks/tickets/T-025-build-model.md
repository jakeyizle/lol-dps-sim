# T-025: Build model, store and sim input

Status: ready
Milestone: M4
Scenarios: BUILD-001, BUILD-002, BUILD-003, BUILD-004, BUILD-005, BUILD-006, BUILD-010, BUILD-011, BUILD-012, BUILD-013, TGT-002
Depends on: T-024

## Notes

- `apps/web/src/model/`: `Build` (id, name, champion, level, ranks override, item ids, stacks, rotation, attacker health %), `DummyTarget`, `Settings` (game time, max duration, crit mode, DPS windows). Pure functions + a Zustand store (add `zustand`).
- `toSimulation(build, target, patch)` → `SimAttacker` + `SimTarget` via `equip`, champion kit registry (`packages/engine/src/champions/index.ts`: id → kit factory), `abilityRanks` unless overridden.
- BUILD-004 limits: points ≤ level, per-ability max rank, R at 6/11/16 (put the R level requirements in patch constants, DATA-015).
- BUILD-012 / BUILD-013: store the settings and pass them into the effect context (`attackerHealthPercent`, `gameTime`); no effect uses them yet.
- Rune page defaults wait for M5; BUILD-001's "default rune page" is an empty page until then (note it in the scenario check-in).

## Done when

- Listed scenarios have passing tagged tests (component/unit level); lint, typecheck, scenarios:check green
