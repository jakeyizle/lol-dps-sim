# T-044: Share links

Status: ready
Milestone: M8
Scenarios: SAVE-003, SAVE-004, SAVE-007
Depends on: T-043

## Notes

- Encode the shared state (builds, target(s), settings) as compressed JSON in the URL hash (`CompressionStream` deflate + base64url; fall back to plain base64 when unavailable).
- Opening a link loads it as a separate, unsaved view with an explicit "Save to my builds" (SAVE-007); invalid links show a notice and fall back to saved work (SAVE-004).
- Reuse T-043's migrations for links from older versions.

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green; deployed
