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
import { ASHE_FOCUS, ashe } from "./ashe";

/**
 * Hand-calculated from patch 26.22 data (PLAN §8), ±1%. Ashe level 18, no items:
 * AD 59 + 3 × 17 = 110 (no bonus AD), ranks Q5 W5 E5 R3.
 */
const data = parsePatch({ champions, items, runes, constants, targets });
const champion = data.champions.Ashe;
if (!champion) throw new Error("no Ashe in 26.22 data");
const kit = ashe(champion, 18);
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
const attackOnly: Rotation = [{ action: "attack" }];
function atLaunch(read: (ctx: EffectContext) => number) {
  const seen: number[] = [];
  const effect: Effect = {
    id: "Probe",
    onAttackLaunch: (ctx) => seen.push(read(ctx)),
  };
  return { seen, effect };
}

describe("Frost Shot", () => {
  it("attacks slow the target", { tags: ["ASHE-001"] }, () => {
    const basic = hits(run(attackOnly), "basic");
    // buffs are recorded as damage lands, before on-hit effects
    expect(basic[0]?.buffs).not.toContain("AsheFrost");
    expect(basic[1]?.buffs).toContain("AsheFrost");
  });

  it(
    "attacks on slowed targets deal 1 + crit × (1 + bonus crit damage) of the attack",
    { tags: ["ASHE-006", "ASHE-007"] },
    () => {
      const basic = hits(
        run(attackOnly, { bonus: { critChance: 0.5 } }),
        "basic",
      );
      // the first attack lands on an unslowed target
      within1(basic[0]?.damage.postMitigation, 110);
      within1(basic[1]?.damage.postMitigation, 110 * 1.5);
      // her crits add nothing themselves
      expect(basic[1]?.damage.crit).toBe("notCritable");
      const ie = hits(
        run(attackOnly, { bonus: { critChance: 0.5, critDamage: 0.3 } }),
        "basic",
      );
      within1(ie[1]?.damage.postMitigation, 110 * (1 + 0.5 * 1.3));
    },
  );
});

describe("Ranger's Focus", () => {
  it("attacks build Focus up to 4", { tags: ["ASHE-002"] }, () => {
    const { seen, effect } = atLaunch((ctx) => ctx.buffStacks(ASHE_FOCUS));
    run(attackOnly, { extra: [effect] });
    expect(seen.slice(0, 6)).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it(
    "at max Focus, Q grants 60% attack speed for 6 s",
    { tags: ["ASHE-003"] },
    () => {
      const { seen, effect } = atLaunch((ctx) => ctx.stats.attackSpeed);
      const r = run(
        kit.rotation.filter((x) => x.action !== "W"),
        {
          extra: [effect],
        },
      );
      const q = r.actions.find((a) => a.action === "Q");
      expect(q).toBeDefined();
      // 0.658 ratio × 0.6
      within1((seen[5] ?? 0) - (seen[0] ?? 0), 0.658 * 0.6);
    },
  );

  it(
    "flurries deal Q's 130% AD over 5 arrows; the first has a 6th arrow",
    { tags: ["ASHE-008"] },
    () => {
      const r = run(kit.rotation.filter((x) => x.action !== "W"));
      const basic = hits(r, "basic");
      // attacks 5 and 6 are flurries (Q after the 4th hit); no crit → Frost ×1
      within1(basic[4]?.damage.postMitigation, 110 * 1.3 * 1.2);
      within1(basic[5]?.damage.postMitigation, 110 * 1.3);
    },
  );

  it("on-hit effects apply once per flurry", { tags: ["ASHE-009"] }, () => {
    const onHit: Effect = {
      id: "OnHit",
      onHit: (ctx) => {
        ctx.deal({
          type: "true",
          amount: 10,
          source: "item",
          sourceId: "OnHit",
          onHit: true,
        });
      },
    };
    const r = run(
      kit.rotation.filter((x) => x.action !== "W"),
      {
        extra: [onHit],
      },
    );
    expect(hits(r, "OnHit")).toHaveLength(hits(r, "basic").length);
  });
});

it(
  "W: one arrow of 200 + 100% bonus AD when its 0.25 s cast ends, slowing",
  { tags: ["ASHE-004"] },
  () => {
    const r = run([{ action: "W" }, { action: "attack" }], {
      bonus: { critChance: 1 },
    });
    const w = hits(r, "AsheW")[0];
    expect(w?.time).toBe(0.25);
    within1(w?.damage.postMitigation, 200);
    // the first attack lands on a target W slowed: × (1 + 1)
    within1(hits(r, "basic")[0]?.damage.postMitigation, 220);
  },
);

it(
  "default rotation: Q at max Focus, W after an attack, attack; R only if added",
  { tags: ["ASHE-005"] },
  () => {
    expect(kit.rotation).toEqual([
      {
        action: "Q",
        when: [{ kind: "minStacks", buff: ASHE_FOCUS, stacks: 4 }],
      },
      { action: "W", when: [{ kind: "afterAttack" }] },
      { action: "attack" },
    ]);
    expect(kit.abilities.map((a) => a.id)).toContain("R");
  },
);
