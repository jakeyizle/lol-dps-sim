# T-021: Item effects, batch 2

Status: ready
Milestone: M3
Scenarios: written in T-020 (The Collector, Guinsoo's Rageblade, Navori Flickerblade, Statikk Shiv, Rapid Firecannon, Terminus)
Depends on: T-020

## Notes

- Verify each item's scenario against 26.22 before coding; values from item data only.
- The Collector's execute uses `executeBelow` (SIM-023) and is off in the DPS run (METRIC-009).
- Guinsoo's and Navori interact with crit chance and ability cooldowns; check the hook order covers them.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
