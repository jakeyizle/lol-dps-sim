# T-001: Monorepo scaffold

Status: ready
Milestone: M0
Scenarios: none
Depends on: none

## Notes

- `git init`; mirror mmr-groups' root: `package.json` (pnpm, `type: module`), `pnpm-workspace.yaml`, `tsconfig.base.json` (strict), `eslint.config.js` (type-aware), Prettier, `.nvmrc`, `.gitignore`.
- Package skeletons: `packages/engine` (with one trivial test so `pnpm test` runs) and `packages/data` (empty `src/index.ts`, zod dependency) so T-004 can add schemas there.
- Root scripts: `lint`, `typecheck`, `test`, `format`. Copy versions from `../mmr-groups/package.json`.
- Leave `champion-data/` in place until the data pipeline replaces it (M1).

## Done when

- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass on a clean clone
