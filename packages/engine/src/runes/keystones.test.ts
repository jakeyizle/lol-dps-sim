import { parsePatch, type ChampionData } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import { testChampion, testConstants } from "../../test/champions";
import type { Effect, EffectContext } from "../core/effects";
import { simulate, type SimTarget } from "../core/sim";
import type { StatBonuses } from "../core/stats";
import {
  CONQUEROR,
  conqueror,
  HAIL_OF_BLADES,
  hailOfBlades,
  LETHAL_TEMPO,
  lethalTempo,
  PRESS_THE_ATTACK,
  pressTheAttack,
} from "./keystones";

/**
 * Real 26.22 rune data on the round-number test champion (level 1, AD 60, base AS 0.6,
 * ratio 0.5, +40% AS → 0.8 AS; attacks land 0.25 s after launch).
 */
const data = parsePatch({ champions, items, runes, constants });
const rune = (id: number) => {
  const r = data.runes[String(id)];
  if (!r) throw new Error(`no rune ${String(id)}`);
  return r;
};
const melee: ChampionData = {
  ...testChampion,
  stats: {
    ...testChampion.stats,
    attackRange: { base: 125, perLevel: 0 },
  },
};
const big: SimTarget = {
  maxHealth: 1e9,
  defender: { armor: 0, magicResist: 0 },
};

function run(
  keystone: (champion: ChampionData) => Effect,
  opts: {
    champion?: ChampionData;
    extra?: Effect[];
    bonus?: StatBonuses;
    target?: Partial<SimTarget>;
    maxDuration?: number;
  } = {},
) {
  const champion = opts.champion ?? testChampion;
  return simulate(
    {
      champion,
      level: 1,
      constants: testConstants,
      bonuses: [{ attackSpeed: 0.4, ...opts.bonus }],
      items: opts.extra ?? [],
      runes: [keystone(champion)],
    },
    { ...big, ...opts.target },
    { maxDuration: opts.maxDuration ?? 10 },
  );
}

/** Reads a value at each attack launch, before the runes (SIM-024 order). */
function atLaunch(read: (ctx: EffectContext) => number) {
  const seen: number[] = [];
  const effect: Effect = {
    id: "Probe",
    onAttackLaunch: (ctx) => seen.push(read(ctx)),
  };
  return { seen, effect };
}
const hits = (r: ReturnType<typeof run>, sourceId: string) =>
  r.trace.filter((t) => t.damage.instance.sourceId === sourceId);
const round = (xs: number[]) => xs.map((x) => Math.round(x * 1e6) / 1e6);

const tempo = (c: ChampionData) => lethalTempo(rune(LETHAL_TEMPO), c);

describe("Lethal Tempo", () => {
  it(
    "stacks attack speed per attack up to its max",
    { tags: ["RUNE-003"] },
    () => {
      // ranged: 6% × 0.8 = 4.8% bonus AS per stack → +0.024 AS
      const { seen, effect } = atLaunch((ctx) => ctx.stats.attackSpeed);
      run(tempo, { extra: [effect] });
      expect(round(seen.slice(0, 8))).toEqual([
        0.8, 0.824, 0.848, 0.872, 0.896, 0.92, 0.944, 0.944,
      ]);

      const dummy = atLaunch((ctx) => ctx.buffStacks("LethalTempo"));
      run(tempo, { extra: [dummy.effect], target: { champion: false } });
      expect(dummy.seen.every((s) => s === 0)).toBe(true);
    },
  );

  it(
    "at max stacks, attacks fire a bolt scaling with bonus AS above the cap",
    { tags: ["RUNE-011"] },
    () => {
      const r = run(tempo);
      const attacks = hits(r, "basic").length;
      const bolts = hits(r, "LethalTempo");
      // from the 6th attack on; 9 × (1 + 0.4 + 6 × 0.048) × 0.667 (ranged)
      expect(bolts).toHaveLength(attacks - 5);
      expect(bolts[0]?.damage.instance.type).toBe("physical");
      expect(bolts[0]?.damage.postMitigation).toBeCloseTo(9 * 1.688 * 0.667, 5);

      // +1000% bonus AS (replacing the 40%) is far over the cap, but the bolt still scales with it
      const fast = hits(
        run(tempo, { bonus: { attackSpeed: 10 } }),
        "LethalTempo",
      );
      expect(fast[0]?.damage.postMitigation).toBeCloseTo(
        9 * (1 + 10 + 0.288) * 0.667,
        5,
      );
    },
  );

  it(
    "loses stacks one at a time after its duration",
    { tags: ["RUNE-012"] },
    () => {
      const seen: [number, number][] = [];
      let launches = 0;
      // After the 6th attack, attacks stop (they wait for mana that never comes).
      const stop: Effect = {
        id: "Stop",
        onAttackLaunch: (ctx) => {
          launches += 1;
          if (launches !== 6) return;
          ctx.setAttackMode({ slot: "basic", critSlot: "basic", cost: 1e9 });
          for (const at of [5.99, 6.01, 6.29, 6.31, 6.61, 7.49, 7.51])
            ctx.schedule(at, (later) => {
              seen.push([at, later.buffStacks("LethalTempo")]);
            });
        },
      };
      run(tempo, { extra: [stop], maxDuration: 30 });
      // 6 stacks; one lost at 6 s, then one every 0.3 s
      expect(seen).toEqual([
        [5.99, 6],
        [6.01, 5],
        [6.29, 5],
        [6.31, 4],
        [6.61, 3],
        [7.49, 1],
        [7.51, 0],
      ]);
    },
  );

  it(
    "uses melee values for melee and ranged multipliers for ranged",
    { tags: ["RUNE-013"] },
    () => {
      // melee: 6% per stack (+0.03 AS); bolt 9 × (1 + bonus AS), no multiplier
      const { seen, effect } = atLaunch((ctx) => ctx.stats.attackSpeed);
      const r = run(tempo, { champion: melee, extra: [effect] });
      expect(round(seen.slice(0, 3))).toEqual([0.8, 0.83, 0.86]);
      expect(hits(r, "LethalTempo")[0]?.damage.postMitigation).toBeCloseTo(
        9 * 1.76,
        5,
      );
    },
  );
});

it(
  "Press the Attack: the third hit in a row deals damage and exposes the target",
  { tags: ["RUNE-004"] },
  () => {
    const r = run(() => pressTheAttack(rune(PRESS_THE_ATTACK)), {
      maxDuration: 5,
    });
    const proc = hits(r, "PressTheAttack");
    const attacks = hits(r, "basic");
    expect(proc).toHaveLength(1);
    expect(proc[0]?.time).toBe(attacks[2]?.time);
    // 40 at level 1, adaptive (physical for an AD build)
    expect(proc[0]?.damage.postMitigation).toBe(40);
    expect(proc[0]?.damage.instance.type).toBe("physical");
    // the third attack isn't amplified; later ones take 8% more
    expect(round(attacks.map((a) => a.damage.postMitigation))).toEqual([
      60, 60, 60, 64.8,
    ]);
  },
);

describe("Hail of Blades", { tags: ["RUNE-005"] }, () => {
  const hail = (c: ChampionData) => hailOfBlades(rune(HAIL_OF_BLADES), c);

  it("speeds up the first three attacks and adds true damage", () => {
    // ranged: +60% → 0.6 + 0.5 × 1.0 = 1.1 AS for the triggering attack and two more
    const { seen, effect } = atLaunch((ctx) => ctx.stats.attackSpeed);
    const r = run(hail, { extra: [effect], maxDuration: 5 });
    expect(round(seen)).toEqual([1.1, 1.1, 1.1, 0.8, 0.8]);
    expect(round(r.actions.map((a) => a.time))).toEqual(
      round([0, 1 / 1.1, 2 / 1.1, 3 / 1.1, 3 / 1.1 + 1.25]),
    );
    // 2 true damage at level 1 (+12% bonus AD, none here)
    expect(hits(r, "HailOfBlades").map((h) => h.damage.postMitigation)).toEqual(
      [2, 2, 2],
    );
  });

  it("lifts the attack speed cap and comes back after its cooldown", () => {
    const { seen, effect } = atLaunch((ctx) => ctx.stats.attackSpeed);
    run(hail, { extra: [effect], bonus: { attackSpeed: 5 }, maxDuration: 13 });
    // 0.6 + 0.5 × 5.6 = 3.4, over the 2.5 cap
    expect(round(seen.slice(0, 4))).toEqual([3.4, 3.4, 3.4, 2.5]);
    // spent at the 3rd launch (2/3.4 s); ready again 10 s later
    const boosted = seen.filter((s) => s > 3).length;
    expect(boosted).toBe(6);

    const dummy = atLaunch((ctx) => ctx.buffStacks("HailOfBlades"));
    run(hail, { extra: [dummy.effect], target: { champion: false } });
    expect(dummy.seen.every((s) => s === 0)).toBe(true);
  });
});

describe("Conqueror", { tags: ["RUNE-006"] }, () => {
  const conq = (c: ChampionData) => conqueror(rune(CONQUEROR), c);
  // 1.8 adaptive per stack at level 1 → 1.08 AD

  it("stacks per attack (2 melee, 1 ranged) up to its max", () => {
    const ranged = atLaunch((ctx) => ctx.stats.attackDamage.total);
    run(conq, { extra: [ranged.effect], maxDuration: 20 });
    expect(round(ranged.seen.slice(0, 3))).toEqual([60, 61.08, 62.16]);
    expect(round(ranged.seen).at(-1)).toBe(round([60 + 12 * 1.08])[0]);

    const m = atLaunch((ctx) => ctx.stats.attackDamage.total);
    run(conq, { champion: melee, extra: [m.effect] });
    expect(round(m.seen.slice(0, 3))).toEqual([60, 62.16, 64.32]);
  });

  it("abilities add 2 stacks, once per spell per interval", () => {
    // every hit also deals ability damage from one spell
    const spell: Effect = {
      id: "Spell",
      onHit: (ctx) => {
        ctx.deal({
          type: "magic",
          amount: 1,
          source: "ability",
          sourceId: "Spell",
          ability: true,
        });
      },
    };
    const { seen, effect } = atLaunch((ctx) => ctx.buffStacks("Conqueror"));
    run(conq, { extra: [effect, spell], maxDuration: 7 });
    // hits at 0.25, 1.5, 2.75, 4.0 (spell ready again at 4.25), 5.25 …
    expect(seen.slice(0, 6)).toEqual([0, 3, 4, 5, 6, 9]);
  });
});
