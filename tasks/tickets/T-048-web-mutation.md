# T-048: Web logic in mutation scope + audit

Status: ready
Milestone: M9
Scenarios: — (PLAN §8)
Depends on: T-047

## Notes

- Add `apps/web/src/model/**` and `apps/web/src/ui/useAnalysis.ts` to Stryker's scope (jsdom tests run under Stryker's vitest runner); leave pure presentation components out.
- Audit survivors as in T-047.

## Done when

- No undocumented survivors in web logic; `mutate:changed` covers web; lint, typecheck green; deployed
