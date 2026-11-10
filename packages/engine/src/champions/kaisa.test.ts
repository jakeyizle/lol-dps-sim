import { parsePatch } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import targets from "../../../data/generated/26.22/targets.json";
import type { Effect, EffectContext } from "../core/effects";
import type { Rotation } from "../core/rotation";
import { simulate, type SimResult, type SimTarget } from "../core/sim";
import type { StatBonuses } from "../core/stats";
import { KAISA_PLASMA, kaisa } from "./kaisa";

/**
 * Hand-calculated from patch 26.22 data (PLAN §8), ±1%. Kai'Sa level 18, no items:
 * AD 59 + 2.6 × 17 = 103.2 (no bonus AD), bonus AS 1.8% × 17 = 30.6%, ranks Q5 W5 E5 R3.
 * Caustic Wounds at 18: 30 (+12% AP) plus 8 (+3% AP) per stack.
 */
const data = parsePatch({ champions, items, runes, constants, targets });
const champion = data.champions.Kaisa;
if (!champion) throw new Error("no Kai'Sa in 26.22 data");
const kit = kaisa(champion, 18);
const target: SimTarget = {
  maxHealth: 1e9,
  defender: { armor: 0, magicResist: 0 },
};
const run = (
  rotation: Rotation,
  opts: { bonus?: StatBonuses; extra?: Effect[]; maxDuration?: number } = {},
) =>
  simulate(
    {
      champion,
      level: 18,
      constants: data.constants,
      bonuses: [opts.bonus ?? {}],
      abilities: kit.abilities,
      kit: kit.kit,
      items: opts.extra ?? [],
      rotation,
    },
    target,
    { maxDuration: opts.maxDuration ?? 10 },
  );
const within1 = (actual: number | undefined, expected: number) => {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) / expected - 1)).toBeLessThan(0.01);
};
const hits = (r: SimResult, sourceId: string) =>
  r.trace.filter((t) => t.damage.instance.sourceId === sourceId);
const casts = (r: SimResult, action: string) =>
  r.actions.filter((a) => a.action === action).map((a) => a.time);
const attackOnly: Rotation = [{ action: "attack" }];
function atLaunch(read: (ctx: EffectContext) => number) {
  const seen: number[] = [];
  const effect: Effect = {
    id: "Probe",
    onAttackLaunch: (ctx) => seen.push(read(ctx)),
  };
  return { seen, effect };
}

describe("Plasma", () => {
  it(
    "each attack deals Caustic Wounds, more per stack, and adds a stack",
    { tags: ["KAISA-001"] },
    () => {
      const wounds = hits(run(attackOnly), "KaisaCausticWounds");
      expect(
        wounds.slice(0, 6).map((w) => Math.round(w.damage.postMitigation)),
      ).toEqual([30, 38, 46, 54, 62, 30]);
    },
  );

  it(
    "the 5th application ruptures for 15% of missing health and resets the stacks",
    { tags: ["KAISA-002"] },
    () => {
      const r = run(attackOnly);
      const rupture = hits(r, "KaisaRupture");
      // before the 5th attack's own damage: 4 attacks + Caustic Wounds 30…62
      const missing = 4 * 103.2 + (30 + 38 + 46 + 54 + 62);
      within1(rupture[0]?.damage.postMitigation, 0.15 * missing);
      expect(rupture[0]?.time).toBe(hits(r, "basic")[4]?.time);
    },
  );
});

describe("evolutions", () => {
  const evolvedBuffs = (bonus: StatBonuses) =>
    hits(run(attackOnly, { bonus, maxDuration: 1 }), "basic")[0]?.buffs ?? [];

  it(
    "Q evolves at 100 AD from items and level growth (55.8 from items at 18)",
    { tags: ["KAISA-003"] },
    () => {
      const missiles = (attackDamage: number) =>
        hits(
          run([{ action: "Q" }], { bonus: { attackDamage }, maxDuration: 1 }),
          "KaisaQ",
        ).length;
      expect(missiles(55)).toBe(6);
      expect(missiles(56)).toBe(12);
      expect(evolvedBuffs({ attackDamage: 56 })).toContain("KaisaQEvolved");
    },
  );

  it("W evolves at 100 AP", { tags: ["KAISA-011"] }, () => {
    expect(evolvedBuffs({ abilityPower: 99 })).not.toContain("KaisaWEvolved");
    expect(evolvedBuffs({ abilityPower: 100 })).toContain("KaisaWEvolved");
  });

  it(
    "E evolves at 100% bonus attack speed including level growth (69.4% from items)",
    { tags: ["KAISA-012"] },
    () => {
      expect(evolvedBuffs({ attackSpeed: 0.69 })).not.toContain(
        "KaisaEEvolved",
      );
      expect(evolvedBuffs({ attackSpeed: 0.695 })).toContain("KaisaEEvolved");
    },
  );
});

it(
  "Q: 6 missiles land 0.4 s after the cast, 100 + 5 × 25 on one target",
  { tags: ["KAISA-004"] },
  () => {
    const q = hits(run([{ action: "Q" }], { maxDuration: 1 }), "KaisaQ");
    expect(q.every((m) => m.time === 0.4)).toBe(true);
    within1(
      q.reduce((s, m) => s + m.damage.postMitigation, 0),
      100 + 5 * 25,
    );
  },
);

describe("Supercharge", () => {
  it(
    "after the charge, +80% attack speed (rank 5) for 4 s",
    { tags: ["KAISA-005"] },
    () => {
      const charged = atLaunch((ctx) => ctx.stats.attackSpeed);
      const base = atLaunch((ctx) => ctx.stats.attackSpeed);
      run([{ action: "E" }, { action: "attack" }], { extra: [charged.effect] });
      run(attackOnly, { extra: [base.effect] });
      within1((charged.seen[0] ?? 0) - (base.seen[0] ?? 0), 0.644 * 0.8);
    },
  );

  it(
    "charges for 1.2 − 0.4 × bonus AS seconds, at least 0.6",
    { tags: ["KAISA-008"] },
    () => {
      // the first attack starts when the charge ends
      const first = (bonus: StatBonuses) =>
        casts(
          run([{ action: "E" }, { action: "attack" }], { bonus }),
          "attack",
        )[0];
      within1(first({}), 1.2 - 0.4 * 0.306);
      within1(first({ attackSpeed: 2 }), 0.6);
    },
  );

  it(
    "each attack cuts its remaining cooldown by 0.5 s",
    { tags: ["KAISA-009"] },
    () => {
      const r = run([{ action: "E" }, { action: "attack" }], {
        maxDuration: 12,
      });
      const [, second] = casts(r, "E");
      expect(second).toBeDefined();
      const landed = hits(r, "basic").filter((h) => h.time < (second ?? 0));
      // 10 s cooldown from the first cast at 0
      within1(second, 10 - 0.5 * landed.length);
    },
  );
});

describe("Void Seeker", () => {
  it(
    "deals 130 + 130% AD magic damage and applies 2 Plasma (3 evolved)",
    { tags: ["KAISA-006"] },
    () => {
      const stacksAfter = (bonus: StatBonuses) => {
        const { seen, effect } = atLaunch((ctx) =>
          ctx.buffStacks(KAISA_PLASMA),
        );
        const r = run([{ action: "W" }, { action: "attack" }], {
          bonus,
          extra: [effect],
          maxDuration: 2,
        });
        return { r, stacks: seen[0] };
      };
      const plain = stacksAfter({});
      const w = hits(plain.r, "KaisaW")[0];
      within1(w?.damage.postMitigation, 130 + 1.3 * 103.2);
      expect(w?.damage.instance.type).toBe("magic");
      expect(plain.stacks).toBe(2);
      expect(stacksAfter({ abilityPower: 100 }).stacks).toBe(3);
    },
  );

  it(
    "evolved, a champion hit refunds 75% of its cooldown",
    { tags: ["KAISA-010"] },
    () => {
      const w = (bonus: StatBonuses) =>
        casts(run([{ action: "W" }], { bonus, maxDuration: 15 }), "W");
      // 14 s cooldown from 0; at the 0.4 s hit 13.6 s remain → 3.4 s
      within1(w({ abilityPower: 100 })[1], 0.4 + 0.25 * 13.6);
      expect(w({})[1]).toBe(14);
    },
  );
});

it(
  "default rotation: E first, Q after an attack, W after an attack at 2+ Plasma, attack",
  { tags: ["KAISA-007"] },
  () => {
    expect(kit.rotation).toEqual([
      { action: "E" },
      { action: "Q", when: [{ kind: "afterAttack" }] },
      {
        action: "W",
        when: [
          { kind: "afterAttack" },
          { kind: "minStacks", buff: KAISA_PLASMA, stacks: 2 },
        ],
      },
      { action: "attack" },
    ]);
  },
);
