# T-013: Scheduled data update workflow

Status: ready
Milestone: M1
Scenarios: none (PLAN §9)
Depends on: T-010

## Notes

- `.github/workflows/data-update.yml`: weekly cron + manual dispatch; runs `pnpm data:update`; if `packages/data/generated/` changed, opens a PR (branch `data/<patch>`) whose body is the drift report and warnings.
- Make the CLI write the report to a file (`--report <path>`) so the workflow can use it as the PR body.
- Needs `contents: write` and `pull-requests: write`; CI runs on the PR as usual.

## Done when

- Manual dispatch on an unchanged patch exits cleanly without a PR; lint green
