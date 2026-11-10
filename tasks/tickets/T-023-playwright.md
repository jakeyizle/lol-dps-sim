# T-023: Playwright harness

Status: ready
Milestone: M0
Scenarios: none (PLAN §8)
Depends on: none

## Notes

- `apps/web/e2e/` and `playwright.config.ts`, run against `vite preview` (base `/lol-dps-sim/`); one smoke test (patch label visible).
- CI: install Chromium only and cache it; add a `test:e2e` script and run it after build in `ci.yml`.

## Done when

- Smoke test passes locally and in CI; lint green
