# T-043: Local persistence and migrations

Status: ready
Milestone: M8
Scenarios: SAVE-001, SAVE-002, SAVE-005, SAVE-006, TGT-005
Depends on: T-042

## Notes

- Persist builds, compared, target, matrix targets, target presets and settings to localStorage (versioned envelope `{ version, patch, state }`); every read in try/catch, the app works without storage.
- Migrations: a list of `(state) => state` per version, tested from fixtures of each older version.
- Builds remember the patch they were saved on; on load with a newer patch, items missing from the data are dropped with a notice (SAVE-006).
- TGT-005: tag the existing preset test once presets survive a reload.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
