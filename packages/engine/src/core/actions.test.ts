import type { ChampionData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import {
  hastedCooldown,
  simulate,
  type BuffSpec,
  type SimAbility,
  type SimAttacker,
} from "./sim";
import type { EffectContext } from "./effects";
import type { Rotation } from "./rotation";
import { computeStats } from "./stats";

/** Base AS 0.6, ratio 0.5, windup 20%; 300 mana, 50 mana per 5 s (10/s). */
const champion: ChampionData = {
  ...testChampion,
  stats: { ...testChampion.stats, manaRegen: { base: 50, perLevel: 0 } },
};

/** +40% AS → 0.8 attacks/s: attacks start at 0, 1.25, 2.5 …; windup 0.25 s. */
const base: SimAttacker = {
  champion,
  level: 1,
  constants: testConstants,
  bonuses: [{ attackSpeed: 0.4 }],
};
const dummy = { maxHealth: 1e9, defender: { armor: 0, magicResist: 0 } };

const q = (over: Partial<SimAbility> = {}): SimAbility => ({
  id: "Q",
  castTime: 0,
  cooldown: 0,
  cost: 0,
  ...over,
});

/** Q after an attack when usable, otherwise attack. */
const weave: Rotation = [
  { action: "Q", when: [{ kind: "afterAttack" }] },
  { action: "attack" },
];
const qFirst: Rotation = [{ action: "Q" }, { action: "attack" }];

/** Records mana and buff stacks at fight start, attack launches and cast ends. */
function observer() {
  const seen: { mana: number; haste: number }[] = [];
  const record = (ctx: EffectContext) => {
    seen.push({ mana: ctx.mana, haste: ctx.buffStacks("haste") });
  };
  return {
    seen,
    effect: {
      id: "Observer",
      init: record,
      onAttackLaunch: record,
      onAbilityCast: record,
    },
  };
}

const run = (over: Partial<SimAttacker>, maxDuration = 5) =>
  simulate({ ...base, ...over }, dummy, { maxDuration });

const times = (r: ReturnType<typeof run>, action: string) =>
  r.actions.filter((a) => a.action === action).map((a) => a.time);

const close = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((t, i) => {
    expect(t).toBeCloseTo(expected[i] ?? NaN, 9);
  });
};

const haste: BuffSpec = {
  id: "haste",
  maxStacks: 1,
  duration: 2,
  refreshOnStack: true,
  stats: { attackSpeed: 1 },
};

describe("abilities between attacks", () => {
  it(
    "are cast when a windup ends, without waiting for the attack timer",
    { tags: ["SIM-003"] },
    () => {
      const r = run({ abilities: [q({ cooldown: 100 })], rotation: weave });
      close(times(r, "Q"), [0.25]);
      close(times(r, "attack").slice(0, 2), [0, 1.25]);
    },
  );

  it(
    "block other actions until their cast time ends",
    { tags: ["SIM-004"] },
    () => {
      // Q at 0.25 with a 1.5 s cast: the attack timer is ready at 1.25 but must wait to 1.75
      const r = run({
        abilities: [q({ cooldown: 100, castTime: 1.5 })],
        rotation: weave,
      });
      close(times(r, "attack").slice(0, 2), [0, 1.75]);
    },
  );

  it(
    "that reset the attack timer allow an attack when the cast ends",
    { tags: ["SIM-005"] },
    () => {
      const r = run({
        abilities: [q({ cooldown: 100, castTime: 0.1, resetsAttack: true })],
        rotation: weave,
      });
      close(times(r, "attack").slice(0, 2), [0, 0.35]);
    },
  );

  it("come back after their hasted cooldown", { tags: ["SIM-006"] }, () => {
    expect(hastedCooldown(10, 25)).toBe(8);
    // Q at 0.25 is ready again at 8.25; nothing was done since the 7.75 windup end, so it is "after an attack"
    const r = run(
      {
        bonuses: [{ attackSpeed: 0.4, abilityHaste: 25 }],
        abilities: [q({ cooldown: 10 })],
        rotation: weave,
      },
      10,
    );
    close(times(r, "Q"), [0.25, 8.25]);
  });
});

describe("fight start", () => {
  it("has no short-term stacks", { tags: ["SIM-009"] }, () => {
    const { seen, effect } = observer();
    run({ abilities: [q({ buff: haste })], kit: [effect] });
    expect(seen[0]?.haste).toBe(0);
  });

  it("has every ability ready", { tags: ["SIM-018"] }, () => {
    const r = run({
      abilities: [q({ cooldown: 100 })],
      rotation: qFirst,
    });
    close(times(r, "Q"), [0]);
  });

  it("applies long-term stacks from the build", { tags: ["SIM-010"] }, () => {
    const stacks: BuffSpec = {
      id: "souls",
      maxStacks: 100,
      duration: Infinity,
      refreshOnStack: false,
      stats: { attackDamage: 10 },
    };
    const r = run({ initialBuffs: [{ spec: stacks, stacks: 3 }] });
    expect(r.trace[0]?.toHealth).toBe(90); // 60 + 3 × 10
  });
});

describe("buffs", () => {
  it("change attack speed for later attacks", { tags: ["STAT-008"] }, () => {
    // Q at 0 grants +100% AS: 0.6 + 0.5 × 1.4 = 1.3
    const r = run({
      abilities: [q({ cooldown: 100, buff: { ...haste, duration: 100 } })],
      rotation: qFirst,
    });
    close(times(r, "attack").slice(0, 2), [0, 1 / 1.3]);
  });

  it("expire on schedule", { tags: ["SIM-015"] }, () => {
    // 1.3 AS until 2 s, then back to 0.8: the attack started at 2/1.3 + … uses whichever AS is current
    const r = run({
      abilities: [q({ cooldown: 100, buff: haste })],
      rotation: qFirst,
    });
    const attacks = times(r, "attack");
    const gaps = attacks.slice(1).map((t, i) => t - (attacks[i] ?? 0));
    close(gaps.slice(0, 2), [1 / 1.3, 1 / 1.3]);
    // attack 3 starts at 2/1.3 ≈ 1.54 (< 2, still hasted): next at +1/1.3 ≈ 2.31
    // attack 4 starts at 2.31 (> 2, buff gone): next at +1.25
    expect(gaps[3]).toBeCloseTo(1.25, 9);
  });

  it("can lift the attack speed cap", { tags: ["STAT-006"] }, () => {
    const huge = { attackSpeed: 10 }; // 0.6 + 0.5 × 10 = 5.6
    expect(
      computeStats({
        champion,
        level: 1,
        constants: testConstants,
        bonuses: [huge],
      }).attackSpeed,
    ).toBe(2.5);
    expect(
      computeStats({
        champion,
        level: 1,
        constants: testConstants,
        bonuses: [huge],
        attackSpeedCap: 4,
      }).attackSpeed,
    ).toBe(4);
    const lifted: BuffSpec = {
      id: "lift",
      maxStacks: 1,
      duration: Infinity,
      refreshOnStack: false,
      stats: huge,
      attackSpeedCap: 4,
    };
    const r = run({ initialBuffs: [{ spec: lifted, stacks: 1 }] }, 1);
    close(times(r, "attack").slice(0, 2), [0, 0.25]);
  });
});

describe("damage over time", () => {
  it("ticks every interval for its duration", { tags: ["SIM-014"] }, () => {
    const r = run({
      abilities: [
        q({
          cooldown: 100,
          dot: {
            instance: {
              type: "true",
              amount: 10,
              source: "ability",
              sourceId: "Q",
            },
            interval: 1,
            duration: 3,
          },
        }),
      ],
      rotation: qFirst,
    });
    close(
      r.trace
        .filter((e) => e.damage.instance.sourceId === "Q")
        .map((e) => e.time),
      [1, 2, 3],
    );
  });
});

describe("mana", () => {
  const manaSeen = (r: { mana: number }[]) => r.map((s) => s.mana);

  it("starts full", { tags: ["SIM-019"] }, () => {
    const { seen, effect } = observer();
    run({ kit: [effect] });
    expect(manaSeen(seen)[0]).toBe(300);
  });

  it("drops by an ability's cost", { tags: ["SIM-021"] }, () => {
    const { seen, effect } = observer();
    run({
      abilities: [q({ cooldown: 100, cost: 120 })],
      rotation: qFirst,
      kit: [effect],
    });
    // init, then Q's cast ends at time 0 (cast time 0): 300 − 120
    expect(manaSeen(seen).slice(0, 2)).toEqual([300, 180]);
  });

  it(
    "regenerates and gates abilities until there is enough",
    { tags: ["SIM-020"] },
    () => {
      // cost 200: cast at 0 leaves 100; 100 more takes 10 s at 10/s
      const r = run(
        {
          abilities: [q({ cost: 200 })],
          rotation: [{ action: "Q" }],
        },
        15,
      );
      close(times(r, "Q"), [0, 10]);
    },
  );

  it("never exceeds max mana", { tags: ["SIM-020"] }, () => {
    const { seen, effect } = observer();
    run({ kit: [effect] });
    expect(seen.length).toBeGreaterThan(2);
    expect(Math.max(...manaSeen(seen))).toBe(300);
  });
});

it("rejects unknown actions", () => {
  expect(() => run({ rotation: [{ action: "nope" }] })).toThrow(
    /unknown action nope/,
  );
});
