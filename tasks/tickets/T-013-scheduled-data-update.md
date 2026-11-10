# T-013: Scheduled data update workflow

Status: in-progress
Milestone: M1
Scenarios: none (PLAN §9)
Depends on: T-010

## Notes

- `.github/workflows/data-update.yml`: weekly cron + manual dispatch; runs `pnpm data:update`; if `packages/data/generated/` changed, opens a PR (branch `data/<patch>`) whose body is the drift report and warnings.
- Make the CLI write the report to a file (`--report <path>`) so the workflow can use it as the PR body.
- Needs `contents: write` and `pull-requests: write`.
- Implemented (`data-update.yml`, `--report`); a local rerun on 26.22 leaves the data unchanged.
- Remaining: once this is on `main`, run `gh workflow run data-update.yml` and confirm it exits without a PR.
- PRs opened with the default `GITHUB_TOKEN` do not trigger CI; add a fine-grained PAT secret if data PRs should run checks automatically.

## Done when

- Manual dispatch on an unchanged patch exits cleanly without a PR; lint green
