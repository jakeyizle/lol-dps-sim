import type { ChampionData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import type { DamageInstance } from "./damage";
import { stackingBuff } from "./effects";
import { conditionTime, type Rotation, type RotationState } from "./rotation";
import {
  simulate,
  type SimAbility,
  type SimAttacker,
  type SimTarget,
} from "./sim";

/** AD 60; 300 mana, 10 mana/s; +40% AS → attacks start at 0, 1.25, 2.5 …, land +0.25 s. */
const champion: ChampionData = {
  ...testChampion,
  stats: { ...testChampion.stats, manaRegen: { base: 50, perLevel: 0 } },
};
const base: SimAttacker = {
  champion,
  level: 1,
  constants: testConstants,
  bonuses: [{ attackSpeed: 0.4 }],
};
const dummy: SimTarget = {
  maxHealth: 1e9,
  defender: { armor: 0, magicResist: 0 },
};

const hit = (sourceId: string, amount: number): DamageInstance => ({
  type: "true",
  amount,
  source: "ability",
  sourceId,
  ability: true,
});
const ability = (id: string, over: Partial<SimAbility> = {}): SimAbility => ({
  id,
  castTime: 0,
  cooldown: 100,
  cost: 0,
  ...over,
});

const run = (
  rotation: Rotation,
  abilities: SimAbility[],
  opts: { target?: Partial<SimTarget>; maxDuration?: number } & Partial<
    Pick<SimAttacker, "kit">
  > = {},
) =>
  simulate(
    { ...base, rotation, abilities, kit: opts.kit },
    { ...dummy, ...opts.target },
    { maxDuration: opts.maxDuration ?? 5 },
  );

const times = (r: ReturnType<typeof run>, action: string) =>
  r.actions.filter((a) => a.action === action).map((a) => a.time);

describe("rule priority", { tags: ["ROT-001"] }, () => {
  it("takes the first rule whose action is ready and conditions hold", () => {
    const r = run(
      [
        { action: "Q", when: [{ kind: "targetHealthBelow", fraction: 0 }] },
        { action: "W" },
        { action: "E" },
        { action: "attack" },
      ],
      [ability("Q"), ability("W"), ability("E")],
    );
    expect(r.actions.slice(0, 3).map((a) => a.action)).toEqual([
      "W",
      "E",
      "attack",
    ]);
    expect(times(r, "Q")).toEqual([]);
  });
});

describe("waiting", { tags: ["ROT-002"] }, () => {
  it("waits for the earliest time a rule becomes usable", () => {
    const r = run([{ action: "Q" }], [ability("Q", { cooldown: 3 })], {
      maxDuration: 7,
    });
    expect(times(r, "Q")).toEqual([0, 3, 6]);
  });

  it("re-checks conditions when other events change the state", () => {
    // Q's DoT ticks 100 a second; health first drops below 50% (to 400) at the 6th tick.
    const r = run(
      [
        { action: "Q" },
        { action: "E", when: [{ kind: "targetHealthBelow", fraction: 0.5 }] },
      ],
      [
        ability("Q", {
          dot: { instance: hit("Q", 100), interval: 1, duration: 10 },
        }),
        ability("E"),
      ],
      { target: { maxHealth: 1000 }, maxDuration: 8 },
    );
    expect(times(r, "E")).toEqual([6]);
  });
});

describe("rotations that can never act", { tags: ["ROT-012"] }, () => {
  it("idle to the max duration", () => {
    const r = run(
      [
        { action: "Q", when: [{ kind: "minMana", amount: 1000 }] },
        { action: "attack", when: [{ kind: "afterAttack" }] },
      ],
      [ability("Q")],
    );
    expect(r).toMatchObject({ killed: false, ttk: null, actions: [] });
    expect(r.trace).toEqual([]);
  });
});

describe("target health condition", { tags: ["ROT-003"] }, () => {
  it("is false at or above the threshold", () => {
    // 600 health, 60 per attack: exactly 30% after 7 landings, below after 8 (at 9.0 s).
    const r = run(
      [
        { action: "R", when: [{ kind: "targetHealthBelow", fraction: 0.3 }] },
        { action: "attack" },
      ],
      [ability("R", { damage: hit("R", 1) })],
      { target: { maxHealth: 600 }, maxDuration: 12 },
    );
    expect(times(r, "R")).toEqual([9]);
  });
});

describe("would-kill condition", { tags: ["ROT-013"] }, () => {
  const rotation: Rotation = [
    { action: "R", when: [{ kind: "wouldKill" }] },
    { action: "attack" },
  ];
  const r200 = ability("R", { damage: hit("R", 200) });

  it("casts only when the damage covers health", () => {
    // 1000 − 60 × 14 = 160 ≤ 200 after the 14th landing (16.5 s); 220 after the 13th.
    const r = run(rotation, [r200], {
      target: { maxHealth: 1000 },
      maxDuration: 20,
    });
    expect(times(r, "R")).toEqual([16.5]);
    expect(r).toMatchObject({ killed: true, ttk: 16.5 });
  });

  it("counts shields", () => {
    // health + 50 shield ≤ 200 → health ≤ 150: after the 15th landing (17.75 s).
    const r = run(rotation, [r200], {
      target: { maxHealth: 1000, shields: [{ amount: 50, blocks: "all" }] },
      maxDuration: 20,
    });
    expect(times(r, "R")).toEqual([17.75]);
  });

  it("uses an ability's estimate when its damage comes from an effect", () => {
    const r = run(
      rotation,
      [ability("R", { estimate: () => [hit("R", 1e10)] })],
      { maxDuration: 1 },
    );
    expect(times(r, "R")).toEqual([0]);
  });
});

describe("buff stack condition", { tags: ["ROT-004"] }, () => {
  it("skips the rule until the stacks are reached", () => {
    const fury = {
      id: "Fury",
      maxStacks: 5,
      duration: Infinity,
      refreshOnStack: true,
    };
    // stacks on landing: 3 stacks after the landing at 2.75 s.
    const r = run(
      [
        { action: "Q", when: [{ kind: "minStacks", buff: "Fury", stacks: 3 }] },
        { action: "attack" },
      ],
      [ability("Q")],
      { kit: [stackingBuff(fury, "hit")] },
    );
    expect(times(r, "Q")).toEqual([2.75]);
  });
});

describe("after-attack condition", { tags: ["ROT-005"] }, () => {
  it("skips the rule until a windup has ended since the last action", () => {
    const r = run(
      [{ action: "Q", when: [{ kind: "afterAttack" }] }, { action: "attack" }],
      [ability("Q", { cooldown: 0 })],
      { maxDuration: 2 },
    );
    // Q is ready at 0 but waits for the first windup; then once after each attack.
    expect(times(r, "Q")).toEqual([0.25, 1.5]);
    expect(times(r, "attack")).toEqual([0, 1.25]);
  });
});

describe("resource condition", { tags: ["ROT-006"] }, () => {
  it("skips the rule until mana reaches the amount", () => {
    // Q costs 100: 300 → 200 at 0; 250 is reached at 5.0 s.
    const r = run(
      [
        { action: "Q", when: [{ kind: "minMana", amount: 250 }] },
        { action: "attack" },
      ],
      [ability("Q", { cooldown: 0, cost: 100 })],
      { maxDuration: 6 },
    );
    expect(times(r, "Q")).toEqual([0, 5]);
  });

  it("skips abilities that cost more than the attacker can have", () => {
    const r = run(
      [{ action: "Q" }, { action: "attack" }],
      [ability("Q", { cost: 400 })],
      { maxDuration: 2 },
    );
    expect(times(r, "Q")).toEqual([]);
    expect(times(r, "attack")).toEqual([0, 1.25]);
  });
});

describe("mana condition timing", { tags: ["ROT-006"] }, () => {
  const state = (over: Partial<RotationState> = {}): RotationState => ({
    time: 2,
    afterAttack: false,
    mana: 50,
    maxMana: 300,
    manaRegen: 5,
    targetHealth: 100,
    targetMaxHealth: 100,
    buffStacks: () => 0,
    wouldKill: () => false,
    ...over,
  });
  const at = (amount: number, over: Partial<RotationState> = {}) =>
    conditionTime({ kind: "minMana", amount }, "Q", state(over));

  it("holds now with enough mana, later as mana regenerates, never past max mana", () => {
    expect(at(30)).toBe(2);
    expect(at(50)).toBe(2);
    // 25 missing at 5 per second
    expect(at(75)).toBe(7);
    expect(at(300, { mana: 290 })).toBe(4);
    expect(at(301)).toBe(Infinity);
    expect(at(75, { manaRegen: 0 })).toBe(Infinity);
    expect(at(50, { manaRegen: 0 })).toBe(2);
  });
});
