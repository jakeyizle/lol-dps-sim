# LoL DPS Sim — Plan

Compare League of Legends **ADC item builds** by simulating fights against configurable enemy targets: "Kraken → Runaan's or IE → Runaan's for Jinx at 3 items vs. a bruiser?", "at which item does Lord Dominik's overtake Mortal Reminder vs. this tank?", "which of my builds wins vs. squishies, bruisers _and_ tanks?"

Goals: accurate enough to trust for build decisions, ~$0 to run (static site), cheap to keep current every patch, and a portfolio-quality codebase. Development is done almost entirely by LLMs, so **the scenarios are the source of truth** and everything is traceable to them.

---

## 1. Scenarios (requirements)

Behavior is specified as Given/When/Then scenarios in `scenarios/*.md`, one file per feature. Code and tests implement scenarios; if behavior changes, the scenario changes first.

### Conventions

- **One file per feature**, kept short. Each file has a unique ID prefix. Each champion gets its own file.
- **IDs:** `<PREFIX>-<NNN>` (e.g. `DMG-004`). Never renumbered, never reused. A removed scenario's ID is retired. New scenarios take the next unused number in that file and may be placed next to related scenarios.
- **Behavior level, not UI level.** "The user adds a fourth build", not "clicks the + button". Assert outcomes (damage, TTK, stats), not mechanisms (how the event queue is ordered).
- **Numbers come from patch data, not scenarios.** Scenarios state formulas and rules ("bonus damage equals the item's `damagePerStack` × stacks"); tests use fixtures with fixed values. Game-wide rules a patch can change (attack speed cap, base crit multiplier) are patch-data constants too (DATA-015). A scenario names a literal number only for engine formulas Riot hasn't changed in years (stat growth, resistances) or for our own defaults.
- **One behavior per scenario.**
- **Strict template** (the check script parses it):

```md
### DMG-004: Armor reduces physical damage

- **Given** a target with 100 armor
- **When** it takes 200 physical damage
- **Then** it loses 100 health
```

- Scenarios under a `## Stretch` heading are not required for MVP.
- **Item, rune and champion scenarios are written (or revised) at the start of the ticket that implements them**, after checking the current patch's mechanics on the League Wiki / in game. The ones listed now describe the intended mechanic and must be re-verified then.

### Linking tests to scenarios (tags)

Every test that verifies a scenario carries the scenario ID as a tag. A test may cover several scenarios; a scenario may be covered at several levels. Tags must be string literals (the check scans source); for table-driven tests, tag the enclosing `describe`.

| Runner             | Syntax                                                |
| ------------------ | ----------------------------------------------------- |
| Playwright (≥1.42) | `test('crit ev', { tag: '@DMG-006' }, async () => …)` |
| Vitest (≥4.1)      | `test('crit ev', { tags: ['DMG-006'] }, () => …)`     |

`vitest.config.ts` builds `test.tags` by parsing `scenarios/*.md` (shared parser in `scripts/scenarios.ts`, ported from mmr-groups), so a test referencing a nonexistent ID fails (`strictTags`). Filtering: `vitest --tags-filter=DMG-006`, `playwright test --grep @DMG-006`.

### `pnpm scenarios:check` (runs in CI)

`scripts/check-scenarios.ts`:

1. Parses scenario IDs from `scenarios/*.md`; **fails** on duplicate IDs or malformed headings.
2. Scans Playwright test files for `@ID` tags; **fails** on unknown IDs (Vitest already enforces this).
3. Reports scenarios with no tagged test, and those tagged only in `e2e/`. `--strict` (CI) makes either an error for non-stretch scenarios.

### Scenario files

| File             | Prefix | Covers                                                      |
| ---------------- | ------ | ----------------------------------------------------------- |
| `data.md`        | DATA   | Patch data pipeline, validation, drift check                |
| `stats.md`       | STAT   | Champion stats from level, items, runes, shards, buffs      |
| `damage.md`      | DMG    | Damage pipeline: crit, amps, resistances, pen, reductions   |
| `sim.md`         | SIM    | Event loop, attack timing, end conditions, determinism, RNG |
| `rotation.md`    | ROT    | Rotation rules, defaults, editing                           |
| `items.md`       | ITEM   | Attacker item effects                                       |
| `runes.md`       | RUNE   | Rune and shard effects                                      |
| `target.md`      | TGT    | Target setup, dummy, overrides, defensive effects           |
| `metrics.md`     | METRIC | TTK, DPS windows, damage curve, breakdown, event log        |
| `compare.md`     | CMP    | Side-by-side, item-count timeline, build × target matrix    |
| `builder.md`     | BUILD  | Build editing, stacks, gold, settings, stats panel          |
| `persistence.md` | SAVE   | localStorage, share URLs, patch versions                    |
| `jinx.md`        | JINX   | Jinx kit + default rotation                                 |
| `caitlyn.md`     | CAIT   | Caitlyn kit + default rotation                              |
| `ashe.md`        | ASHE   | Ashe kit + default rotation                                 |
| `kaisa.md`       | KAISA  | Kai'Sa kit + default rotation                               |
| `vayne.md`       | VAYNE  | Vayne kit + default rotation                                |

---

## 2. Scope

**MVP**

- Full discrete-event sim of one attacker vs. one target; target never fights back; always in range (stand and shoot)
- Champions: Jinx, Caitlyn, Ashe, Kai'Sa, Vayne
- ~30 ADC-relevant items + boots + Doran's Blade, including items that change TTK or timing (executes, phantom hits, cooldown refunds); core damage runes + stat shards
- Inputs: items (ordered, ≤ 6, exclusive groups enforced), runes + shards, level, skill ranks, long-term stacks (short-term state always starts at 0), attacker health % (static), game time
- Mana: fight starts at full mana and regenerates; abilities and Jinx rockets cost mana
- Editable per-champion default rotations (priority lists)
- Target: enemy champion + level + items, or custom dummy, with stat overrides; defensive item effects
- Metrics: TTK, DPS over N seconds, cumulative damage curve, breakdown, event log — all equally prominent
- Compare: builds side by side, item-count timeline, build × target matrix
- Crit: expected value or seeded RNG (Monte Carlo spread)
- Static SPA: localStorage, share URLs

**Stretch:** more champions (all marksmen, then other on-hit champs), ally buffs, skillshot hit rate, kiting downtime, rotation optimizer, champion vs champion at equal gold, gold efficiency, AoE / multiple targets, previous-patch comparison.

**Out of scope:** two-way duels, accounts / server storage, pathing / terrain / projectile collision.

---

## 3. Stack

| Concern       | Choice                                                              |
| ------------- | ------------------------------------------------------------------- |
| Language      | TypeScript (strict) everywhere                                      |
| Monorepo      | pnpm workspaces                                                     |
| Web           | React + Vite, Tailwind, Zustand (`persist`), inline SVG charts      |
| Heavy compute | Web Workers via Comlink, pool sized to `hardwareConcurrency`        |
| Validation    | zod (generated data, URL and localStorage payloads)                 |
| Tests         | Vitest 4.1 (projects: engine, data, scripts, web/jsdom), Playwright |
| Mutation      | Stryker (`mutate:changed`), from M9                                 |
| Scripts       | Node (type stripping) / `tsx`                                       |
| Hosting       | GitHub Pages (static)                                               |

## 4. Layout

```
packages/engine/       pure TS, no DOM: core/, champions/, items/, runes/, targets/
packages/data/         generated/<patch>/*.json, overrides/, typed loaders + zod schemas
packages/data-pipeline/  fetch + normalize scripts, manifest of champions/items/runes
apps/web/              React SPA (+ sim worker)
e2e/                   Playwright
scenarios/             *.md scenario files
scripts/               scenarios.ts (parser), check-scenarios.ts
tasks/                 ROADMAP.md, LOG.md, tickets/
```

The engine stays free of UI and fetching so it runs in workers, tests and a possible CLI.

## 5. Data pipeline

**Sources** (checked 2026-11-09; live patch 26.22 = game version 16.22.1). Riot names patches by year (26.x) while Data Dragon and CommunityDragon keep the game version (16.x): public = game major + 10 (DATA-021).

| Source           | Used for                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data Dragon      | Patch list, champion ids/names + mana, item gold + stats, icons. Tooltips have no numbers. Champion stats come from game files instead (DATA-019): Data Dragon 16.22.1 lists 0 AD per level for every champion; disagreements are reported (DATA-020). The old `champion-data/` (16.2.1) is replaced.                                                                                                                                                                                                                                                                                                               |
| CommunityDragon  | Fetched from the **patch's own folder** (`raw.communitydragon.org/<major.minor>/`), never `latest` (DATA-010). `characters/<c>/<c>.bin.json`: windup per attack slot (normal, crit, alternate) as either `mAttackCastTime / mAttackTotalTime` (e.g. Jinx) or `0.3 + mAttackDelayCastOffsetPercent` (e.g. Caitlyn, Ashe, Vayne), windup modifier `mAttackDelayCastOffsetPercentAttackSpeedRatio` (default 1), `attackSpeedRatioModifiable`, `critDamageMultiplier` (Ashe is 1.0), spell `DataValues` per rank (index 0 = rank 0), spell calculations; item and rune bins for passive values. Raw floats are rounded. |
| League Wiki      | Manual reference for scenarios, test fixtures and `overrides/`. Not scraped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Meraki Analytics | Not used: stale since 15.9.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

`pnpm data:update [patch]`: fetch only what the manifest lists → normalize to `ChampionData` / `ItemData` / `RuneData` / `Constants` → merge `overrides/` (game constants like the attack speed cap and base crit multiplier, hand-authored skill orders, corrections) → zod-validate → write `generated/<public major.minor>/` (e.g. `26.22`) → print drift report vs. the previous patch. Effect code reads values **by name** (`item.values.damagePerStack`); missing keys fail the run (DATA scenarios). Balance patch = re-run script; mechanic rework = scenario change, then code.

## 6. Engine

**Discrete-event loop.** A priority queue of timed events (action decision, windup end, attack ready, cast, damage, buff expiry, DoT tick, target state change). Pop earliest → apply → notify effect hooks; when the attacker is free, the rotation picks the next action. Ends when the target is dead (no revive left, or executed) or at max duration. Every damage instance is recorded; all metrics derive from that trace. Assumptions: damage lands at windup end (no projectile travel), attacks never cancelled, crit rolls are independent, attacker health is a static setting. Mana starts full and regenerates.

**DPS run.** DPS windows come from a second run where the target's health keeps falling below 0, missing-health effects cap at 100% of max health, and revive / stasis / execute are off (METRIC-008, METRIC-009).

**Stats.** `stat(L) = base + growth × (L−1) × (0.7025 + 0.0175 × (L−1))`. `AS = baseAS + asRatio × bonusAS%`, bonus including per-level growth; capped at the patch's attack speed cap unless an effect lifts it. Windup time = `B + K × (W/AS − B)` with `B = W/baseAS`, per attack slot. Total crit damage = champion multiplier + bonuses; bonus crit damage = bonuses only (26.1 abilities scale on it). Stats are recomputed when buffs change, via a `modifyStats` hook.

**Damage pipeline.** Raw (physical / magic / true) → crit (on-hit excluded) → attacker amps → resistances (flat reduction → % reduction → % pen → flat pen/lethality; `100/(100+R)` or `2 − 100/(100−R)` if negative) → target reductions → shields (typed shields only absorb their type; item shields can decay) → health → execute check. Instances carry tags (`autoAttack`, `onHit`, `crit`, `ability`, `source`).

**Effects.** Champions, items, runes and target defenses implement one interface: `init`, `modifyStats`, `onAttackLaunch`, `onHit`, `onAbilityCast`, `modifyOutgoing`, `modifyIncoming`, `onDamageDealt`. A `Buff` primitive (stacks, max, expiry, refresh rule) is scheduled by the loop. Hook order is fixed and documented. Shared helpers (every-Nth-attack, stacking buff, AA reset, empowered attack) keep champion kits short.

**Rotations are data**: an ordered list of `{ action, when?: Condition[] }`; the first ready action whose conditions all hold is taken. Champions declare which actions/conditions they support. This lets the UI edit rotations and URLs carry them.

**RNG.** Seeded PRNG per run; seed stored in results. EV mode is deterministic (single run); RNG mode runs N times and aggregates.

**API.** `simulate(scenario, opts)`, `simulateMany(scenario, opts & { runs })`, `compareTimeline(build, target, opts)`, `compareMatrix(builds, targets, opts)`.

## 7. Web app

- **Builder**: build list (add / duplicate / rename / delete); build editor (champion, level, skills, items, runes, stacks, rotation); target editor; live stats panel.
- **Results tabs**: Side-by-side · Timeline · Matrix · Event log. Recompute debounced in the worker pool; stale jobs cancelled.
- **State**: Zustand store with `schemaVersion` + migrations in localStorage. Share URL `#s=` + lz-string-compressed `{ v, patch, builds, targets, settings }`, using ids not names, zod-checked on load.

## 8. Testing

| Level     | Tool                                    | Covers                                                                            |
| --------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| Unit      | Vitest (`engine`, `data` projects)      | stats, damage math, event loop, effects, rotations, pipeline normalization        |
| Golden    | Vitest                                  | per-champion full sims: metrics + event-log snapshot; changes reviewed on purpose |
| Component | Vitest (`web`, jsdom + Testing Library) | editors, results views, store, URL codec                                          |
| E2E       | Playwright                              | build → compare → share link round trip; timeline; matrix                         |

- Pick the lowest level that genuinely verifies a scenario.
- Engine tests use fixture data with round numbers, not live patch data, so balance patches never break them. A separate `data` test loads the real generated patch and runs one smoke sim per champion.
- **Accuracy fixtures**: per champion, hand-calculated cases (±1%) and Practice Tool measurements (±3%), recorded with the patch they were taken on.
- **Golden snapshots are never updated on their own.** A change to a golden snapshot needs a hand-calculated accuracy fixture in the same commit that explains the new value; otherwise the snapshot change is treated as a bug.
- **Performance**: CMP-005 is an engine benchmark on a fixed fixture with a time budget, run in CI; UI responsiveness (CMP-011) is an E2E check.
- **Mutation testing (M9)**: Stryker `mutate:changed` on PRs over engine + web logic, as in mmr-groups (no survivors on changed lines; equivalent mutants disabled inline with a reason). Float math produces many equivalent mutants (e.g. `<` vs `<=` on continuous values, rounding); expect the engine audit to spend real time disabling them with reasons.
- **Scenario fidelity (M10, optional)**: port mmr-groups' attribution + scenario mutants.

## 9. CI/CD (GitHub Actions)

- **PR:** install → lint → typecheck → test → `scenarios:check --strict` → E2E → (from M9) `mutate:changed`.
- **main:** same checks → build → deploy to GitHub Pages.
- **Scheduled (weekly):** `data:update` against the latest patch; on a diff, open a PR with the drift report in the description.

## 10. Documentation

Only: `PLAN.md`, `scenarios/*.md`, `tasks/`, `CLAUDE.md`, and one `README.md` (what it is, live link, screenshot, stack, run/test/deploy, Riot "Legal Jibber Jabber" disclaimer). No other docs; comments only where the code is non-obvious.
