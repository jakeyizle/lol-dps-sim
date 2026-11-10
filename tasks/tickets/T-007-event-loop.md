# T-007: Event loop core

Status: ready
Milestone: M2
Scenarios: SIM-001, SIM-002, SIM-022, SIM-007, SIM-008, SIM-011, SIM-023
Depends on: T-006

## Notes

- `packages/engine/src/core/sim.ts`: priority queue of timed events; auto-attack-only attacker (rotation comes in M3) vs. a target with health/resistances.
- Windup per SIM-002 using the attack slot's percent and modifier; damage lands at windup end; next attack at 1/AS after start.
- Records every damage instance (time, source, pre/post mitigation, flags) as the trace; result has `killed`, `ttk`, remaining health.
- Execute: a target-side threshold the loop checks after each instance (SIM-023); the effect that sets it comes with The Collector.
- Ties: events at the same time run in insertion order; document it.
- EV mode only here; seeded RNG + aggregation is its own roadmap item.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
