# Log

`T-NNN | YYYY-MM-DD | one-line summary` (find the commit with `git log --grep T-NNN`)

- T-001 | 2026-11-09 | pnpm 12 monorepo, TS 6 strict base, ESLint type-aware + Prettier, engine + data package skeletons with Vitest 4.1
- T-002 | 2026-11-09 | scenario parser + `scenarios:check` ported from mmr-groups, root Vitest config with scenario tags + projects
- T-004 | 2026-11-09 | data pipeline for 5 champions: patch-matched CDragon, both windup formats + per-slot inheritance, stats from game files (DDragon 16.22.1 has 0 AD/level), zod schemas
- T-005 | 2026-11-09 | engine stats: level growth, base/bonus split, AS ratio + patch cap, crit cap, total/bonus crit damage; @lol/data types
- T-006 | 2026-11-09 | damage pipeline: resist/pen order, negative resist, crit EV/roll with crit reduction, on-hit exclusion, amps, target reductions, typed shields
- T-007 | 2026-11-09 | discrete-event loop: event heap, windup formula per slot, auto-attack trace, death/max-duration/execute endings (EV mode)
- T-008 | 2026-11-09 | constants (AS cap 3.003 per wiki, verify in Practice Tool), skill-order plans expanded to 18 levels, deep-merge value overrides
- T-009 | 2026-11-09 | ability values per rank (values/cooldowns from rank 0, mana from rank 1, missing lists = 0), raw spell calculations, passive values
