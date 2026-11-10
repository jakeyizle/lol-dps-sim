# T-021: Item effects, batch 2

Status: ready
Milestone: M3
Scenarios: ITEM-014, ITEM-015, ITEM-016, ITEM-017, ITEM-018, ITEM-019, ITEM-020, ITEM-021
Depends on: T-020

## Notes

- Verify each item's scenario against 26.22 before coding; values from item data only.
- The Collector's execute uses `executeBelow` (SIM-023) and is off in the DPS run (METRIC-009).
- Guinsoo's and Navori interact with crit chance and ability cooldowns; check the hook order covers them.
- Not in the item data (add as overrides with reasons): energize stacks per attack and max (game constants, DATA-015), Guinsoo's Phantom stacks and Phantom Hit delay. Terminus' Light/Dark per-level armor is defensive; only Dark pen matters here.
- Navori needs an engine hook to reduce remaining cooldowns.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
