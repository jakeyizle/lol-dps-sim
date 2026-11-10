# T-012: Data loaders

Status: ready
Milestone: M1
Scenarios: DATA-009
Depends on: T-011

## Notes

- `packages/data/src/load.ts`: `patches()` lists generated folders (Vite `import.meta.glob` in the app; a Node variant for tests/scripts), `latestPatch()`, `loadPatch(patch)` → parsed champions, items, runes, constants (zod).
- App shows the patch number in the header (DATA-009); add the `web` Vitest project (jsdom + Testing Library) as in mmr-groups.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
