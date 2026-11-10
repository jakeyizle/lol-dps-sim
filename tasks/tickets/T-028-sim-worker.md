# T-028: Simulation worker and debounced recompute

Status: ready
Milestone: M4
Scenarios: CMP-006, CMP-011
Depends on: T-027

## Notes

- Web Worker via Comlink running `analyze`; inputs are plain data (build ids + patch data), so the worker rebuilds effects itself.
- Debounce edits (~150 ms); a newer job supersedes older ones (drop stale results by job id).
- CMP-011: E2E check that typing in the editor stays responsive while a long matrix-sized job runs (use a deliberately long max duration).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green; deployed
