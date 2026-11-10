# T-036: Build × target matrix

Status: ready
Milestone: M6
Scenarios: CMP-004
Depends on: T-034

## Notes

- Store: a list of targets (current target editor edits the selected one; presets add to the list). Keep `target` working for the single-target views.
- Matrix: rows builds, columns targets, chosen metric; colour = sequential ramp relative to the best in the column (dataviz: one hue, value always printed, hover tooltip). TTK "not killed" cells read as such.
- Targets named by `targetName`, with "(stats only)" (BUILD-009).

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
