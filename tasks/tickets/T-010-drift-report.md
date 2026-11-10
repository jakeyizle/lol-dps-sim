# T-010: Drift report and required values

Status: ready
Milestone: M1
Scenarios: DATA-007, DATA-008
Depends on: T-008, T-009

## Notes

- Drift: compare the new output with the newest existing `generated/<patch>/` (not the same patch); print changed values (old → new), added and removed keys. Pure diff function over JSON + a small formatter.
- Required values: effect code declares the value names it reads per entity (`requiredValues: Record<entityId, string[]>`, exported from `@lol/engine` so the pipeline can import it without circular deps; the engine side stays empty until the first effect). The pipeline fails naming entity and key when one is missing.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
