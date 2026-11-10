import type { ChampionData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import type { BuffSpec, Effect, EffectContext } from "./effects";
import {
  simulate,
  type SimAbility,
  type SimAttacker,
  type SimTarget,
} from "./sim";

/**
 * Edge cases of the fight loop. Base AS 0.6, +40% → 0.8 attacks/s (1.25 s apart);
 * windups: basic 20% (0.25 s), crit 10% (0.125 s), slow 30% (K 0.5).
 */
const champion: ChampionData = {
  ...testChampion,
  attack: {
    ...testChampion.attack,
    slots: {
      basic: { windupPercent: 0.2, windupModifier: 1 },
      slow: { windupPercent: 0.3, windupModifier: 1 },
      crit: { windupPercent: 0.1, windupModifier: 1 },
    },
    critSlot: "crit",
  },
};
const attacker = (over: Partial<SimAttacker> = {}): SimAttacker => ({
  champion,
  level: 1,
  constants: testConstants,
  bonuses: [{ attackSpeed: 0.4 }],
  ...over,
});
const target = (maxHealth = 1e9, over: Partial<SimTarget> = {}): SimTarget => ({
  maxHealth,
  defender: { armor: 0, magicResist: 0 },
  ...over,
});
const probe = (
  read: (ctx: EffectContext) => number,
  hook: "launch" | "hit" = "launch",
) => {
  const seen: number[] = [];
  const effect: Effect = {
    id: "Probe",
    ...(hook === "launch"
      ? { onAttackLaunch: (ctx: EffectContext) => seen.push(read(ctx)) }
      : { onHit: (ctx: EffectContext) => seen.push(read(ctx)) }),
  };
  return { seen, effect };
};
const casts = (r: ReturnType<typeof simulate>, action: string) =>
  r.actions.filter((a) => a.action === action).map((a) => a.time);
const nuke = (amount: number, over: Partial<SimAbility> = {}): SimAbility => ({
  id: "Q",
  castTime: 0,
  cooldown: 10,
  cost: 0,
  damage: {
    type: "true",
    amount,
    source: "ability",
    sourceId: "Nuke",
    ability: true,
  },
  ...over,
});

describe("setup errors", () => {
  it("unknown actions and attack slots fail when the fight starts", () => {
    expect(() =>
      simulate(attacker({ rotation: [{ action: "Z" }] }), target()),
    ).toThrow(/unknown action Z/);
    expect(() => simulate(attacker({ attackSlot: "nope" }), target())).toThrow(
      /nope/,
    );
    const bad: Effect = {
      id: "Bad",
      init: (ctx) => {
        ctx.setAttackMode({ slot: "basic", critSlot: "nope", cost: 0 });
      },
    };
    expect(() => simulate(attacker({ items: [bad] }), target())).toThrow(
      /nope/,
    );
  });
});

it(
  "a non-basic attack slot is also used for crits",
  { tags: ["SIM-022"] },
  () => {
    // the slow slot's 30% windup at 1.25 s is 0.375 s, crit or not
    const r = simulate(
      attacker({
        attackSlot: "slow",
        bonuses: [{ attackSpeed: 0.4, critChance: 1 }],
      }),
      target(),
      { maxDuration: 1, critMode: "rng", seed: 1 },
    );
    expect(r.trace[0]?.time).toBeCloseTo(0.375, 9);
  },
);

describe("buffs", { tags: ["SIM-015"] }, () => {
  const capped = (cap: number): BuffSpec => ({
    id: `Cap${String(cap)}`,
    maxStacks: 1,
    duration: Infinity,
    refreshOnStack: false,
    attackSpeedCap: cap,
  });

  it("the highest lifted attack speed cap wins", () => {
    const { seen, effect } = probe((ctx) => ctx.stats.attackSpeed);
    const lift: Effect = {
      id: "Lift",
      init: (ctx) => {
        ctx.addBuff(capped(3));
        ctx.addBuff(capped(5));
      },
    };
    simulate(
      attacker({ bonuses: [{ attackSpeed: 20 }], items: [lift, effect] }),
      target(),
      {
        maxDuration: 0.1,
      },
    );
    expect(seen[0]).toBe(5);
  });

  it("a buff that doesn't refresh keeps its first expiry", () => {
    const once: BuffSpec = {
      id: "Once",
      maxStacks: 5,
      duration: 2,
      refreshOnStack: false,
    };
    const { seen, effect } = probe((ctx) => ctx.buffStacks("Once"));
    const stack: Effect = {
      id: "Stack",
      onAttackLaunch: (ctx) => {
        ctx.addBuff(once);
      },
    };
    // stacks at 0 and 1.25; gone at 2 even though 1.25 added one
    simulate(attacker({ items: [effect, stack] }), target(), {
      maxDuration: 3,
    });
    expect(seen).toEqual([0, 1, 0]);
  });

  it("a buff without one-at-a-time decay loses every stack at once; the last decaying stack removes it", () => {
    const all: BuffSpec = {
      id: "All",
      maxStacks: 3,
      duration: 1,
      refreshOnStack: true,
    };
    const slow: BuffSpec = {
      id: "Slow",
      maxStacks: 3,
      duration: 1,
      refreshOnStack: true,
      decayOneAtATime: true,
    };
    const seen: [number, number, boolean][] = [];
    const fx: Effect = {
      id: "Fx",
      init: (ctx) => {
        ctx.addBuff(all, 3);
        ctx.addBuff(slow, 2);
        for (const at of [0.9, 1.1, 2.1])
          ctx.schedule(at, (later) => {
            seen.push([
              later.buffStacks("All"),
              later.buffStacks("Slow"),
              false,
            ]);
          });
      },
    };
    const r = simulate(
      attacker({
        items: [fx],
        rotation: [{ action: "Q" }],
        abilities: [nuke(1, { cooldown: 0.5 })],
      }),
      target(),
      { maxDuration: 2.5 },
    );
    expect(seen.map(([a, b]) => [a, b])).toEqual([
      [3, 2],
      [0, 1],
      [0, 0],
    ]);
    // gone, not left at 0 stacks
    expect(r.trace.at(-1)?.buffs).not.toContain("Slow");
  });
});

it(
  "effects see the default game time of 30 minutes",
  { tags: ["BUILD-013"] },
  () => {
    const { seen, effect } = probe((ctx) => ctx.gameTime);
    simulate(attacker({ items: [effect] }), target(), { maxDuration: 0.1 });
    expect(seen[0]).toBe(30);
  },
);

describe("cooldowns", () => {
  it("cutting the cooldown of an unused ability leaves it ready", () => {
    const cut: Effect = {
      id: "Cut",
      init: (ctx) => {
        ctx.reduceCooldowns(["Q"], 0.5);
        ctx.reduceCooldownsBy(["Q"], 2);
      },
    };
    const r = simulate(
      attacker({
        items: [cut],
        abilities: [nuke(1)],
        rotation: [{ action: "Q" }],
      }),
      target(),
      { maxDuration: 1 },
    );
    expect(casts(r, "Q")).toEqual([0]);
  });

  it(
    "decisions that come due mid-windup wait for the windup",
    { tags: ["SIM-004"] },
    () => {
      // Q comes back at 1.3, during the second attack's windup (1.25–1.5)
      const r = simulate(
        attacker({
          abilities: [nuke(1, { cooldown: 1.3 })],
          rotation: [{ action: "Q" }, { action: "attack" }],
        }),
        target(),
        { maxDuration: 2 },
      );
      expect(casts(r, "Q")).toEqual([0, 1.5]);
    },
  );
});

it("target effects without an incoming modifier change nothing", () => {
  const r = simulate(attacker(), target(1e9, { effects: [{ id: "Inert" }] }), {
    maxDuration: 0.5,
  });
  expect(r.trace[0]?.damage.postMitigation).toBe(60);
});

describe("would-kill", { tags: ["ROT-013"] }, () => {
  it("counts attacks, plain ability damage, crits and shields", () => {
    const first = (
      action: string,
      health: number,
      over: Partial<SimAttacker> = {},
      t: Partial<SimTarget> = {},
    ) =>
      simulate(
        attacker({
          abilities: [nuke(100)],
          rotation: [{ action, when: [{ kind: "wouldKill" }] }],
          ...over,
        }),
        target(health, t),
        { maxDuration: 0.5 },
      ).actions[0]?.action;
    expect(first("attack", 60)).toBe("attack");
    expect(first("attack", 61)).toBeUndefined();
    // 50% crit at ×2: 60 × 1.5
    expect(
      first("attack", 90, { bonuses: [{ attackSpeed: 0.4, critChance: 0.5 }] }),
    ).toBe("attack");
    expect(first("Q", 100)).toBe("Q");
    expect(first("Q", 101)).toBeUndefined();
    expect(
      first("Q", 60, {}, { shields: [{ amount: 40, blocks: "all" }] }),
    ).toBe("Q");
    expect(
      first("Q", 60, {}, { shields: [{ amount: 41, blocks: "all" }] }),
    ).toBeUndefined();
  });
});

it(
  "a shield triggered by one damage type ignores the others",
  { tags: ["TGT-014"] },
  () => {
    const r = simulate(
      attacker(),
      target(100, {
        lowHealthShields: [
          {
            id: "Magic",
            below: 0.5,
            trigger: "magic",
            amount: 1000,
            blocks: "all",
            duration: 10,
            cooldown: 90,
          },
        ],
      }),
      { maxDuration: 3 },
    );
    expect(r.targetEvents).toEqual([]);
    expect(r.killed).toBe(true);
  },
);

it(
  "damage exactly equal to health kills rather than executes",
  { tags: ["METRIC-001"] },
  () => {
    const r = simulate(attacker(), target(60, { executeBelow: 0.05 }), {
      maxDuration: 1,
    });
    expect(r).toMatchObject({ killed: true, executed: false });
  },
);

it("attacks are numbered from 1", () => {
  const { seen, effect } = probe(() => 0);
  const indexes: number[] = [];
  const count: Effect = {
    id: "Count",
    onAttackLaunch: (_ctx, attack) => indexes.push(attack.index),
  };
  simulate(attacker({ items: [effect, count] }), target(), { maxDuration: 3 });
  expect(indexes).toEqual([1, 2, 3]);
  expect(seen).toHaveLength(3);
});

it(
  "damage landing exactly at the max duration still counts",
  { tags: ["SIM-008"] },
  () => {
    // attacks land at 0.25 and 1.5
    const r = simulate(attacker(), target(), { maxDuration: 1.5 });
    expect(r.trace.map((t) => t.time)).toEqual([0.25, 1.5]);
  },
);

it("damage over time ticks at its interval", { tags: ["SIM-014"] }, () => {
  const dot: SimAbility = {
    ...nuke(0),
    damage: undefined,
    dot: {
      interval: 0.5,
      duration: 1.5,
      instance: {
        type: "true",
        amount: 5,
        source: "ability",
        sourceId: "Dot",
        ability: true,
      },
    },
  };
  const r = simulate(
    attacker({ abilities: [dot], rotation: [{ action: "Q" }] }),
    target(),
    {
      maxDuration: 3,
    },
  );
  expect(r.trace.map((t) => t.time)).toEqual([0.5, 1, 1.5]);
});

it(
  "damage from ticks and scheduled effects wakes a waiting rotation",
  { tags: ["ROT-002"] },
  () => {
    // only R below half health; the only damage is a DoT and a scheduled hit
    const r = (kind: "dot" | "callback") => {
      const dot: SimAbility = {
        ...nuke(0),
        damage: undefined,
        dot: {
          interval: 1,
          duration: 3,
          instance: {
            type: "true",
            amount: 60,
            source: "ability",
            sourceId: "Dot",
            ability: true,
          },
        },
      };
      const hit: Effect = {
        id: "Later",
        init: (ctx) => {
          ctx.schedule(1, (later) => {
            later.deal({
              type: "true",
              amount: 60,
              source: "item",
              sourceId: "Later",
            });
          });
        },
      };
      return simulate(
        attacker({
          abilities: [
            kind === "dot" ? dot : { ...nuke(0), cooldown: 100 },
            nuke(1, { id: "R" }),
          ],
          items: kind === "dot" ? [] : [hit],
          rotation: [
            { action: "Q" },
            {
              action: "R",
              when: [{ kind: "targetHealthBelow", fraction: 0.5 }],
            },
          ],
        }),
        target(100),
        { maxDuration: 3 },
      );
    };
    expect(casts(r("dot"), "R")).toEqual([1]);
    expect(casts(r("callback"), "R")).toEqual([1]);
  },
);

describe("more edges", () => {
  it("a bad attack slot fails even if the rotation never attacks", () => {
    expect(() =>
      simulate(
        attacker({
          attackSlot: "nope",
          abilities: [nuke(1)],
          rotation: [{ action: "Q" }],
        }),
        target(),
      ),
    ).toThrow(/nope/);
    const bad: Effect = {
      id: "Bad",
      init: (ctx) => {
        ctx.setAttackMode({ slot: "nope", critSlot: "basic", cost: 0 });
      },
    };
    expect(() =>
      simulate(
        attacker({
          items: [bad],
          abilities: [nuke(1)],
          rotation: [{ action: "Q" }],
        }),
        target(),
      ),
    ).toThrow(/nope/);
  });

  it(
    "non-champion targets still use their own execute threshold",
    { tags: ["SIM-023"] },
    () => {
      // 60 per hit: 100 → 40, below 50%
      const r = simulate(
        attacker(),
        target(100, { champion: false, executeBelow: 0.5 }),
        {
          maxDuration: 3,
        },
      );
      expect(r).toMatchObject({ killed: true, executed: true, ttk: 0.25 });
    },
  );

  it(
    "phantom hits skip effects without an on-hit hook",
    { tags: ["ITEM-016"] },
    () => {
      const phantom: Effect = {
        id: "Phantom",
        onHit: (ctx, attack) => {
          if (!attack.phantom) ctx.applyOnHit(attack, 0.1);
        },
      };
      const r = simulate(
        attacker({ items: [{ id: "Inert" }, phantom] }),
        target(),
        {
          maxDuration: 0.5,
        },
      );
      expect(r.trace).toHaveLength(1);
    },
  );

  it(
    "a shield that doesn't decay is gone after its duration",
    { tags: ["TGT-008"] },
    () => {
      // triggers on the first hit (100 → 40 < 50); lasts 1 s
      const r = simulate(
        attacker(),
        target(100, {
          lowHealthShields: [
            {
              id: "S",
              below: 0.5,
              trigger: "all",
              amount: 1000,
              blocks: "all",
              duration: 1,
              cooldown: 90,
            },
          ],
        }),
        { maxDuration: 3 },
      );
      expect(r.trace.map((t) => t.absorbed)).toEqual([60, 0, 0]);
    },
  );

  it(
    "a decision that comes due while busy waits for the windup to end",
    { tags: ["SIM-004"] },
    () => {
      // Q back at 1.3; damage at 1.2 lets the attack rule start an attack (busy 1.2–1.45)
      const nudge: Effect = {
        id: "Nudge",
        init: (ctx) => {
          ctx.schedule(1.2, (later) => {
            later.deal({
              type: "true",
              amount: 2,
              source: "item",
              sourceId: "Nudge",
            });
          });
        },
      };
      const r = simulate(
        attacker({
          items: [nudge],
          abilities: [nuke(1, { cooldown: 1.3 })],
          rotation: [
            { action: "Q" },
            {
              action: "attack",
              when: [{ kind: "targetHealthBelow", fraction: 0.98 }],
            },
          ],
        }),
        target(100),
        { maxDuration: 2 },
      );
      expect(casts(r, "attack")).toEqual([1.2]);
      expect(casts(r, "Q")).toEqual([0, 1.45]);
    },
  );
});
