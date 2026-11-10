# T-045: README, strict scenarios, E2E journeys

Status: ready
Milestone: M8
Scenarios: — (process: PLAN §8, §9)
Depends on: T-044

## Notes

- One `README.md` per PLAN §9: what it is, live link, screenshot, stack, run/test/deploy, Riot "Legal Jibber Jabber" disclaimer.
- CI: `scenarios:check --strict` (all 222 required scenarios are covered since T-044).
- E2E journeys beyond the smoke tests: compare two builds (table + chart), champion target with an item, matrix with presets, rotation edit changing TTK.

## Done when

- CI runs strict scenarios and the journeys; lint, typecheck green; deployed
