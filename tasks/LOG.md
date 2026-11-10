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
- T-010 | 2026-11-09 | drift report vs newest older patch (checked 16.18 → 16.22), required-values check from `@lol/engine/required-values`; note: 16.12 game files lack `mrPerLevel`
- T-003 | 2026-11-09 | React 19 + Vite 8 + Tailwind 4 shell, CI workflow (lint, typecheck, test, scenarios:check, build), GitHub Pages deploy on main
- T-014 | 2026-11-09 | buffs (stacks, expiry, stat bonuses, AS cap lift), casts (cast time, haste cooldowns, AA resets), DoTs, mana (start full, regen, costs); policy callback until rotations
- T-015 | 2026-11-09 | seeded RNG crit mode (crit slot windup), simulateMany with mean/p10/p50/p90 + kill rate, CMP-005 benchmark (34 ms locally for 4×3×200)
- T-011 | 2026-11-09 | items (30: stats mapped to engine names, passive values, exclusive groups from ItemGroup max-ownable) and runes (21 incl. shards, values from perks bin, trees from runesReforged); note 26.22 Kraken data is every-3rd-attack (AttackCount 3), not stacks
- T-012 | 2026-11-09 | data loaders (latestPatch, parsePatch with cross-file patch check), web loads newest generated patch via import.meta.glob and shows it; web Vitest project (jsdom + Testing Library)
- T-013 | 2026-11-10 | weekly + manual data-update workflow (--report as PR body, branch data/<patch>); dispatch on 26.22 exits with "Data unchanged"; GITHUB_TOKEN PRs don't trigger CI (add a PAT secret if wanted)
- T-016 | 2026-11-10 | Effect interface (init, modifyStats, onAttackLaunch, onHit, onAbilityCast, modifyOutgoing, modifyIncoming, onDamageDealt) run kit → items → runes; attacks carry extra on-land instances; helpers everyNthAttack, stackingBuff, empoweredAttack; itemStats/itemEffects/equip; SimAbility keeps its fixed payload for simple casts
- T-017 | 2026-11-10 | rotations as data (rules + targetHealthBelow, wouldKill, minStacks, afterAttack, minMana) replace Policy; waits until the earliest usable time and re-decides after DoT/buff/callback events; wouldKill uses EV post-mitigation vs health + shields (SimAbility.estimate for effect damage); abilities costing more than max mana are never usable
- T-018 | 2026-11-10 | addItem: 6-item limit, one pair of boots (message names the owned boots), exclusive groups (message names the conflict); duplicates of ungrouped items allowed
- T-019 | 2026-11-10 | Jinx kit (minigun stacks with first-stack weight + one-at-a-time decay, rockets: RocketTAD, bonus-AS penalty, mana per attack, stacks kept for the first rocket; W with AS-scaled cast time; R max range + missing health) and default rotation; engine: attack modes (slot, crit slot, cost), amountScale, bonusAttackSpeedReduction, stat-based cast times, GameCalculation evaluator, abilityRanks; overrides: Q cast 0, W cast 0.6, MinigunFirstStackWeight 2; 26.22 accuracy fixtures. To verify in Practice Tool: W cast scalar reading, stack decay cadence
