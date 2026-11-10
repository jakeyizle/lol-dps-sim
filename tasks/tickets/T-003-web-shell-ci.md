# T-003: Web shell, CI and Pages deploy

Status: ready
Milestone: M0
Scenarios: none
Depends on: T-002

## Notes

- `apps/web`: Vite + React + Tailwind; one page showing the app name.
- `.github/actions/setup` (pnpm + node from `.nvmrc`) and `ci.yml` modeled on mmr-groups: lint → typecheck → test → `scenarios:check` (non-strict until M8).
- `deploy.yml` on `main`: CI, then build and deploy to GitHub Pages (`base` set for the repo path).

## Done when

- A PR runs CI green; merging to `main` publishes the shell to GitHub Pages
