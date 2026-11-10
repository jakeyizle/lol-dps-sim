# Roadmap

## Process

- **Roadmap** (this file): milestones → work items. Tick items when done.
- **Tickets** (`tickets/T-NNN-slug.md`): open work only. Written in chunks: when fewer than ~3 tickets are `ready`, write the next chunk of ~5–8 from the unticked items below (may cross a milestone boundary). Link each item to its ticket (`→ T-012`).
- **Log** (`LOG.md`): one line per completed ticket.
- **IDs:** `T-NNN`, next = highest in `tickets/` or `LOG.md` + 1.
- **Tickets never restate requirements.** Reference scenario IDs and `PLAN.md` sections; add only approach, files, and gotchas. If needed behavior isn't in a scenario, add the scenario first.
- **Item, rune and champion tickets start by verifying their scenarios** against the current patch (wiki / Practice Tool) and editing them if mechanics differ (PLAN §1).
- **Finishing a ticket**, in one commit (`T-012: <summary>`, see `CLAUDE.md`): delete the ticket file, append to `LOG.md`, tick the item here and drop its ticket link.

Ticket template:

```md
# T-012: <title>

Status: ready | in-progress
Milestone: M3
Scenarios: ITEM-004, ITEM-008
Depends on: T-010

## Notes

- <approach, files, gotchas>

## Done when

- Listed scenarios have passing tagged tests; lint, typecheck, scenarios:check green
```

Each milestone ends deployed, with its scenarios passing.

## M0 — Foundation

- [x] pnpm monorepo, TS strict base, ESLint + Prettier, `packages/engine` skeleton with Vitest
- [x] Scenario parser + `scenarios:check` + Vitest tag config (port from mmr-groups)
- [x] Vite + React app shell, GitHub Actions checks + GitHub Pages deploy
- [ ] Playwright harness against `vite preview` → T-023

## M1 — Data (DATA)

- [x] Pipeline: manifest, patch-matched fetch, champion stats + attack data for all 5 MVP champions (both windup formats, modifier, per-slot), schemas, write
- [x] Ability values; constants + skill-order overrides; overrides merge
- [x] Items (incl. exclusive groups) and runes; DATA-001 complete
- [x] Drift report + missing-key check
- [x] `packages/data` loaders; remove old `champion-data/`
- [x] Scheduled `data:update` workflow opening a PR

## M2 — Engine core (STAT, DMG, SIM)

- [x] Stats: level growth, flat bonuses, AS formula + cap, crit cap, crit damage
- [x] Damage pipeline: resistances, pen order, crit EV/RNG, on-hit exclusion, amps, typed shields, tags
- [x] Event loop: attack timer, windup formula per slot, end conditions, executes, damage trace
- [x] Buffs, DoTs, cooldowns + haste, cast times, AA resets, mana (start, regen, costs)
- [x] Seeded RNG, `simulateMany` aggregation; CMP-005 engine benchmark in CI

## M3 — Effects, rotation, Jinx (ITEM, ROT, JINX)

- [x] Effect interface + hook order; shared helpers (every-Nth, stacking buff, empowered attack)
- [x] Rotation rules + conditions (incl. would-kill)
- [x] Jinx kit + default rotation + accuracy fixtures
- [x] Build validation: 6 items, exclusive groups, one boots
- [x] Item effects, batch 1: Kraken, BotRK, IE, LDR, on-hit rules; decide MVP item list
- [x] Item effects, batch 2: The Collector, Guinsoo's, Navori, Statikk, RFC, Terminus
- [ ] Item effects, batch 3: remaining MVP items (incl. Nashor's, Wit's End) → T-022

## M4 — First usable UI (METRIC, BUILD)

- [ ] Metrics from trace: TTK, DPS run + windows, curve, breakdown
- [ ] Build editor: champion, level, skills, items, gold, attacker health, game time, stats panel
- [ ] Single build vs. dummy results: table, curve, event log
- [ ] Sim worker (Comlink), debounced recompute

## M5 — Runes & targets (RUNE, TGT)

- [ ] Rune page editor + shards
- [ ] Keystones: Lethal Tempo (stacks, bolt, decay, ranged), PtA, HoB, Conqueror
- [ ] Minor runes: Cut Down, Coup de Grace, Last Stand, Legend: Alacrity, Gathering Storm, Absolute Focus
- [ ] Target editor: champion target (items, runes, shards), dummy, overrides, presets
- [ ] Defensive effects: Randuin's, Steelcaps, shields (typed, decaying), GA, Zhonya's

## M6 — Compare (CMP)

- [ ] Multi-build side by side
- [ ] Item-count timeline
- [ ] Build × target matrix, worker pool, RNG mode in UI; perf check (CMP-005)

## M7 — Remaining champions (CAIT, ASHE, KAISA, VAYNE, ROT)

- [ ] Caitlyn
- [ ] Ashe
- [ ] Kai'Sa
- [ ] Vayne
- [ ] Rotation editor UI

## M8 — Persistence & launch (SAVE)

- [ ] localStorage + schema migrations
- [ ] Share URLs, patch notices, removed-item handling
- [ ] README with disclaimer; E2E journeys; `scenarios:check --strict` in CI

## M9 — Mutation testing (PLAN §8)

- [ ] Stryker on engine + `mutate:changed` PR job
- [ ] Audit: engine
- [ ] Web project in mutation scope; audit: web

## M10 — Scenario fidelity (optional, PLAN §8)

- [ ] Port attribution + scenario mutants from mmr-groups

## Stretch

- [ ] Ally buffs; skillshot hit rate; kiting downtime; rotation optimizer; champ vs champ; gold efficiency; more champions
