import { parsePatch } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import targets from "../../../data/generated/26.22/targets.json";
import type { Effect } from "../core/effects";
import type { Rotation } from "../core/rotation";
import { simulate, type SimResult, type SimTarget } from "../core/sim";
import type { StatBonuses } from "../core/stats";
import { pageProblem } from "../runes";
import { DEFAULT_RUNES, KITS } from ".";

/** Kit behaviour the per-champion files don't pin down. Level 18, real 26.22 data. */
const data = parsePatch({ champions, items, runes, constants, targets });
const IDS = ["Jinx", "Caitlyn", "Ashe", "Kaisa", "Vayne"] as const;
interface Ranks {
  Q: number;
  W: number;
  E: number;
  R: number;
}
const zero: Ranks = { Q: 0, W: 0, E: 0, R: 0 };

const make = (id: string, ranks?: Ranks) => {
  const champion = data.champions[id];
  const factory = KITS[id];
  if (!champion || !factory) throw new Error(id);
  return { champion, kit: factory(champion, 18, ranks) };
};
function fight(
  id: string,
  rotation: Rotation,
  opts: {
    bonus?: StatBonuses;
    items?: Effect[];
    target?: Partial<SimTarget>;
    maxDuration?: number;
    ranks?: Ranks;
  } = {},
): SimResult {
  const { champion, kit } = make(id, opts.ranks);
  return simulate(
    {
      champion,
      level: 18,
      constants: data.constants,
      bonuses: [opts.bonus ?? {}],
      abilities: kit.abilities,
      kit: kit.kit,
      items: opts.items,
      rotation,
    },
    { maxHealth: 1e9, defender: { armor: 0, magicResist: 0 }, ...opts.target },
    { maxDuration: opts.maxDuration ?? 6 },
  );
}
const of = (r: SimResult, sourceId: string) =>
  r.trace.filter((t) => t.damage.instance.sourceId === sourceId);
const phantom: Effect = {
  id: "Phantom",
  onHit: (ctx, attack) => {
    if (!attack.phantom) ctx.applyOnHit(attack, 0.05);
  },
};

it(
  "with no ranks a kit only attacks, and Kai'Sa evolves nothing",
  { tags: ["BUILD-003"] },
  () => {
    for (const id of IDS) {
      const { kit } = make(id, zero);
      expect(kit.abilities, id).toEqual([]);
      expect(kit.rotation, id).toEqual([{ action: "attack" }]);
    }
    expect(make("Jinx", zero).kit.buffs).toEqual([]);
    const r = fight("Kaisa", [{ action: "attack" }], {
      ranks: zero,
      bonus: { attackDamage: 200, abilityPower: 200, attackSpeed: 2 },
      maxDuration: 1,
    });
    expect(r.trace[0]?.buffs.filter((b) => b.endsWith("Evolved"))).toEqual([]);
  },
);

it(
  "each ability's hook acts only on its own cast",
  { tags: ["SIM-024"] },
  () => {
    const own = /^(Jinx|Caitlyn|Ashe|Kaisa|Vayne)[QWER]$/;
    for (const id of IDS)
      for (const ability of make(id).kit.abilities) {
        const r = fight(id, [{ action: ability.id }], { maxDuration: 1.5 });
        const others = r.trace
          .map((t) => t.damage.instance.sourceId)
          .filter((s) => own.test(s) && s !== `${id}${ability.id}`);
        expect(others, `${id} ${ability.id}`).toEqual([]);
      }
    // other casts don't toggle rockets, grant Supercharge or empower Tumble's attack
    const jinx = fight("Jinx", [{ action: "W" }, { action: "attack" }], {
      maxDuration: 1.5,
    });
    expect(of(jinx, "basic")[0]?.buffs).not.toContain("JinxFishbones");
    const kaisa = fight("Kaisa", [{ action: "Q" }, { action: "attack" }], {
      maxDuration: 1.5,
    });
    expect(kaisa.trace.some((t) => t.buffs.includes("KaisaSupercharge"))).toBe(
      false,
    );
    const vayne = fight("Vayne", [{ action: "E" }, { action: "attack" }], {
      maxDuration: 1.5,
    });
    expect(of(vayne, "VayneQ")).toEqual([]);
  },
);

it(
  "Jinx's second Q switches back to the minigun",
  { tags: ["JINX-002"] },
  () => {
    const r = fight("Jinx", [{ action: "Q" }, { action: "attack" }], {
      maxDuration: 4,
    });
    const qs = r.actions.filter((a) => a.action === "Q").map((a) => a.time);
    expect(qs.length).toBeGreaterThanOrEqual(2);
    const between = of(r, "basic").filter(
      (t) => t.time > (qs[1] ?? 0) + 0.01 && t.time < (qs[2] ?? Infinity),
    );
    expect(between.length).toBeGreaterThan(0);
    expect(between.every((t) => !t.buffs.includes("JinxFishbones"))).toBe(true);
  },
);

describe("Kai'Sa", () => {
  it("Q scales with bonus AD", { tags: ["KAISA-004"] }, () => {
    // under the 55.8 AD evolution threshold: 6 missiles of 100 + 55% × 40
    const q = of(
      fight("Kaisa", [{ action: "Q" }], {
        bonus: { attackDamage: 40 },
        maxDuration: 1,
      }),
      "KaisaQ",
    );
    expect(q.reduce((s, m) => s + m.damage.postMitigation, 0)).toBeCloseTo(
      (100 + 22) * 2.25,
      6,
    );
  });

  it(
    "Plasma damage is magic, and phantom hits add none",
    { tags: ["KAISA-001", "KAISA-002"] },
    () => {
      const r = fight("Kaisa", [{ action: "attack" }], { items: [phantom] });
      expect(of(r, "KaisaCausticWounds").length).toBe(of(r, "basic").length);
      expect(of(r, "KaisaCausticWounds")[0]?.damage.instance.type).toBe(
        "magic",
      );
      expect(of(r, "KaisaRupture")[0]?.damage.instance.type).toBe("magic");
    },
  );
});

it(
  "Vayne: Tumble empowers one attack with physical damage; slow third hits still bolt",
  { tags: ["VAYNE-002", "VAYNE-001"] },
  () => {
    const r = fight("Vayne", [{ action: "Q" }, { action: "attack" }], {
      target: { defender: { armor: 0, magicResist: 300 } },
      maxDuration: 3,
      ranks: { Q: 5, W: 0, E: 0, R: 0 },
    });
    const q = of(r, "VayneQ");
    expect(q.length).toBeGreaterThan(0);
    expect(q[0]?.damage.postMitigation).toBe(q[0]?.damage.preMitigation);
    const empowered = new Set(q.map((x) => x.time));
    expect(of(r, "basic").some((b) => !empowered.has(b.time))).toBe(true);

    // −60% AS: hits 2.7 s apart, each within 3.5 s of the last
    const slow = fight("Vayne", [{ action: "attack" }], {
      bonus: { attackSpeed: -0.6 },
      maxDuration: 9,
      target: { maxHealth: 5000 },
    });
    expect(of(slow, "VayneW")).toHaveLength(1);
  },
);

it(
  "Ashe: Frost Shot refreshes, only abilities slow besides attacks, Q spends Focus",
  { tags: ["ASHE-001", "ASHE-002", "ASHE-003"] },
  () => {
    const basic = of(
      fight("Ashe", [{ action: "attack" }], {
        bonus: { critChance: 0.5 },
        maxDuration: 4,
      }),
      "basic",
    );
    expect(basic[2]?.damage.postMitigation).toBeCloseTo(
      (basic[0]?.damage.postMitigation ?? 0) * 1.5,
      6,
    );

    const early: Effect = {
      id: "Early",
      init: (ctx) => {
        ctx.deal({
          type: "true",
          amount: 1,
          source: "item",
          sourceId: "Early",
        });
      },
    };
    const first = of(
      fight("Ashe", [{ action: "attack" }], {
        items: [early],
        bonus: { critChance: 0.5 },
        maxDuration: 1,
      }),
      "basic",
    );
    expect(first[0]?.damage.postMitigation).toBeCloseTo(110, 6);

    const q = fight(
      "Ashe",
      [
        {
          action: "Q",
          when: [{ kind: "minStacks", buff: "AsheFocus", stacks: 4 }],
        },
        { action: "attack" },
      ],
      { maxDuration: 6 },
    );
    const cast = q.actions.find((a) => a.action === "Q")?.time ?? Infinity;
    const next = of(q, "basic").find((t) => t.time > cast);
    expect(next?.buffs).not.toContain("AsheFocus");

    // phantom hits add no Focus: still 4 attacks to fill it
    const ph = fight(
      "Ashe",
      [
        {
          action: "Q",
          when: [{ kind: "minStacks", buff: "AsheFocus", stacks: 4 }],
        },
        { action: "attack" },
      ],
      { items: [phantom], maxDuration: 6 },
    );
    const qAt = ph.actions.findIndex((a) => a.action === "Q");
    expect(
      ph.actions.slice(0, qAt).filter((a) => a.action === "attack"),
    ).toHaveLength(4);
  },
);

it("every default page is valid", { tags: ["BUILD-001"] }, () => {
  for (const id of IDS) {
    const page = DEFAULT_RUNES[id];
    if (!page) throw new Error(id);
    expect(pageProblem(page, data.trees, data.shards), id).toBeUndefined();
  }
});

it(
  "Caitlyn spends the grant that expires first",
  { tags: ["CAIT-002"] },
  () => {
    // W at 0 (sprung 1.25, until 3.05); E once two hits drop the target below 90%
    const r = fight(
      "Caitlyn",
      [
        { action: "W" },
        { action: "E", when: [{ kind: "targetHealthBelow", fraction: 0.9 }] },
        { action: "attack" },
      ],
      {
        target: { maxHealth: 2000 },
        maxDuration: 4,
        ranks: { Q: 0, W: 5, E: 5, R: 0 },
      },
    );
    const head = of(r, "CaitlynHeadshot").map((h) =>
      Math.round(h.damage.postMitigation),
    );
    expect(head.slice(0, 2)).toEqual([
      Math.round(0.8 * 126.6 + 215),
      Math.round(0.8 * 126.6),
    ]);
  },
);

describe("more kit details", () => {
  const pauseUntil = (t: number): Effect => ({
    id: "Pause",
    init: (ctx) => {
      ctx.setAttackMode({ slot: "basic", critSlot: "basic", cost: 1e9 });
      ctx.schedule(t, (later) => {
        later.setAttackMode({ slot: "basic", critSlot: "basic", cost: 0 });
      });
    },
  });

  it(
    "Caitlyn: a later grant that expires sooner is spent first; unused grants expire",
    { tags: ["CAIT-002"] },
    () => {
      // −30% AS (1.09 s apart): W at 0 (until 3.05); E after the first hit (until ~2.4);
      // the second attack sees both and spends the net first, the third the trap
      const r = fight(
        "Caitlyn",
        [
          { action: "W" },
          {
            action: "E",
            when: [{ kind: "targetHealthBelow", fraction: 0.995 }],
          },
          { action: "attack" },
        ],
        {
          bonus: { attackSpeed: -0.3 },
          target: { maxHealth: 20000 },
          maxDuration: 3,
          ranks: { Q: 0, W: 5, E: 5, R: 0 },
        },
      );
      const head = of(r, "CaitlynHeadshot").map((h) =>
        Math.round(h.damage.postMitigation),
      );
      expect(head).toEqual([
        Math.round(0.8 * 126.6),
        Math.round(0.8 * 126.6 + 215),
      ]);

      // a net with no attack for 3 s: its 1.8 s window passes
      const late = fight("Caitlyn", [{ action: "E" }, { action: "attack" }], {
        items: [pauseUntil(3)],
        maxDuration: 3.5,
        ranks: { Q: 0, W: 0, E: 5, R: 0 },
      });
      expect(of(late, "CaitlynHeadshot")).toEqual([]);
    },
  );

  it("Kai'Sa: Q scales with AP", { tags: ["KAISA-004"] }, () => {
    const q = of(
      fight("Kaisa", [{ action: "Q" }], {
        bonus: { abilityPower: 50 },
        maxDuration: 1,
      }),
      "KaisaQ",
    );
    // 6 missiles of 100 + 20% × 50
    expect(q.reduce((s, m) => s + m.damage.postMitigation, 0)).toBeCloseTo(
      110 * 2.25,
      6,
    );
  });

  it("Vayne: each hit refreshes Silver Bolts", { tags: ["VAYNE-001"] }, () => {
    // −100% AS: hits 3.26 s apart, inside the 3.5 s window only if each refreshes it
    const slow = fight("Vayne", [{ action: "attack" }], {
      bonus: { attackSpeed: -1 },
      maxDuration: 8,
      target: { maxHealth: 5000 },
    });
    expect(of(slow, "VayneW")).toHaveLength(1);
  });

  it(
    "Ashe: each hit refreshes Frost Shot; Focus refreshes, then decays one per second",
    { tags: ["ASHE-001", "ASHE-002"] },
    () => {
      // −50% AS: hits 1.5 s apart, so the third launch is past 2 s from the first hit and
      // the target is still slowed only because the second hit refreshed it
      const basic = of(
        fight("Ashe", [{ action: "attack" }], {
          bonus: { critChance: 0.5, attackSpeed: -0.5 },
          maxDuration: 5,
        }),
        "basic",
      );
      expect(basic[2]?.damage.postMitigation).toBeCloseTo(
        (basic[0]?.damage.postMitigation ?? 0) * 1.5,
        6,
      );

      // 4 hits ~1 s apart, then no attacks: Focus holds 4 s past the last hit, then −1 per second
      let n = 0;
      const seen: [number, number][] = [];
      const stop: Effect = {
        id: "Stop",
        onAttackLaunch: (ctx) => {
          n += 1;
          if (n !== 4) return;
          ctx.setAttackMode({ slot: "basic", critSlot: "basic", cost: 1e9 });
          for (const dt of [3.5, 4.5, 5.5, 6.5])
            ctx.schedule(dt, (later) => {
              seen.push([dt, later.buffStacks("AsheFocus")]);
            });
        },
      };
      fight("Ashe", [{ action: "attack" }], {
        items: [stop],
        maxDuration: 12,
        ranks: { Q: 5, W: 0, E: 0, R: 0 },
      });
      // the 4th hit lands ~0.22 s after its launch
      expect(seen).toEqual([
        [3.5, 4],
        [4.5, 3],
        [5.5, 2],
        [6.5, 1],
      ]);
    },
  );

  it(
    "Ashe: no Focus while Ranger's Focus is up",
    { tags: ["ASHE-002"] },
    () => {
      const r = fight(
        "Ashe",
        [
          {
            action: "Q",
            when: [{ kind: "minStacks", buff: "AsheFocus", stacks: 4 }],
          },
          { action: "attack" },
        ],
        { maxDuration: 14, ranks: { Q: 5, W: 0, E: 0, R: 0 } },
      );
      const qs = r.actions.filter((a) => a.action === "Q").map((a) => a.time);
      expect(qs.length).toBe(2);
      // four fresh hits after the 6 s buff ends
      const between = r.actions.filter(
        (a) =>
          a.action === "attack" &&
          a.time >= (qs[0] ?? 0) + 6 &&
          a.time < (qs[1] ?? 0),
      );
      expect(between.length).toBeGreaterThanOrEqual(4);
    },
  );
});
