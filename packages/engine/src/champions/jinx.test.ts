import { describe, expect, it } from "vitest";

import { testConstants, testJinx } from "../../test/champions";
import type { Effect, EffectContext } from "../core/effects";
import type { Rotation } from "../core/rotation";
import {
  simulate,
  type SimAttacker,
  type SimOptions,
  type SimTarget,
} from "../core/sim";
import { jinx } from "./jinx";

/** AD 60, base AS 0.6, ratio 0.5, 300 mana, no regen; armor 0 target. */
const ranks = { Q: 1, W: 1, E: 0, R: 1 };
const kit = jinx(testJinx, 1, ranks);
const dummy: SimTarget = {
  maxHealth: 1e9,
  defender: { armor: 0, magicResist: 0 },
};

function run(
  over: Partial<SimAttacker> & { rotation: Rotation },
  opts: SimOptions & { target?: Partial<SimTarget> } = {},
) {
  return simulate(
    {
      champion: testJinx,
      level: 1,
      constants: testConstants,
      abilities: kit.abilities,
      kit: kit.kit,
      ...over,
    },
    { ...dummy, ...opts.target },
    { maxDuration: 6, ...opts },
  );
}

/** Records something at each attack launch (runs after the kit). */
function atLaunch<T>(read: (ctx: EffectContext) => T) {
  const seen: T[] = [];
  const effect: Effect = {
    id: "Observer",
    onAttackLaunch: (ctx) => seen.push(read(ctx)),
  };
  return { seen, effect };
}

const swapFirst: Rotation = [{ action: "Q" }, { action: "attack" }];
const amounts = (r: ReturnType<typeof run>, sourceId: string) =>
  r.trace
    .filter((t) => t.damage.instance.sourceId === sourceId)
    .map((t) => t.damage.postMitigation);
const times = (r: ReturnType<typeof run>, action: string) =>
  r.actions.filter((a) => a.action === action).map((a) => a.time);
const close = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) => {
    expect(v).toBeCloseTo(expected[i] ?? NaN, 4);
  });
};

describe("minigun", { tags: ["JINX-001"] }, () => {
  it("adds attack speed per landed attack: first stack double, up to Q's max", () => {
    // 40% max over 3 stacks, first worth 2 → 20%, 30%, 40%.
    const { seen, effect } = atLaunch((ctx) => ctx.stats.bonusAttackSpeed);
    run({ rotation: [{ action: "attack" }], items: [effect] });
    close(seen, [0, 0.2, 0.3, 0.4, 0.4]);
  });

  it("loses stacks one at a time when the duration runs out", () => {
    // Attacks land at 0.333, 1.952, 3.362; then attacking stops (unaffordable).
    const stop: Effect = {
      id: "Stop",
      onHit: (ctx) => {
        if (ctx.buffStacks("JinxRevdUp") === 3)
          ctx.setAttackMode({ ...ctx.attackMode(), cost: 1e9 });
      },
    };
    const stacks: number[] = [];
    const probe: Effect = {
      id: "Probe",
      init: (ctx) => {
        for (const t of [5.8, 5.9, 8.4, 10.9])
          ctx.schedule(t, (later) =>
            stacks.push(later.buffStacks("JinxRevdUp")),
          );
      },
    };
    run(
      { rotation: [{ action: "attack" }], items: [stop, probe] },
      { maxDuration: 12 },
    );
    expect(stacks).toEqual([3, 2, 1, 0]);
  });
});

describe("rockets", () => {
  it(
    "deal Q's rocket ratio of total AD and can crit",
    { tags: ["JINX-002"] },
    () => {
      expect(
        amounts(
          run({ rotation: swapFirst }, { maxDuration: 1 }),
          "JinxQAttack",
        ),
      ).toEqual([90]);
      const crit = run(
        { rotation: swapFirst, bonuses: [{ critChance: 1 }] },
        { maxDuration: 1, critMode: "rng" },
      );
      expect(amounts(crit, "JinxQCritAttack")).toEqual([180]);
    },
  );

  it("reduce bonus attack speed by Q's penalty", { tags: ["JINX-010"] }, () => {
    const { seen, effect } = atLaunch((ctx) => ctx.stats.bonusAttackSpeed);
    run(
      { rotation: swapFirst, bonuses: [{ attackSpeed: 0.4 }], items: [effect] },
      { maxDuration: 1 },
    );
    close(seen, [0.2]);
  });

  it("cost Q's mana per attack", { tags: ["JINX-007"] }, () => {
    const { seen, effect } = atLaunch((ctx) => ctx.mana);
    run({ rotation: swapFirst, items: [effect] }, { maxDuration: 4 });
    expect(seen).toEqual([280, 260, 240]);
  });

  it("can't be fired without the mana", { tags: ["JINX-008"] }, () => {
    // 300 mana, 20 per rocket, no regen: 15 rockets, then nothing.
    const r = run({ rotation: swapFirst }, { maxDuration: 60 });
    expect(times(r, "attack")).toHaveLength(15);
    expect(r.actions.at(-1)?.time).toBeLessThan(26);
  });
});

describe("weapon swap", { tags: ["JINX-003"] }, () => {
  it("switches windup and keeps minigun stacks for the first rocket only", () => {
    const rotation: Rotation = [
      {
        action: "Q",
        when: [{ kind: "minStacks", buff: "JinxRevdUp", stacks: 3 }],
      },
      { action: "attack" },
    ];
    const r = run({ rotation }, { maxDuration: 8 });
    // Minigun at 0, 1/0.6, +1/0.7; swap at the 3rd landing (3.362).
    // First rocket at 4.429 with AS 0.6 + 0.5 × 0.4 × 0.5 = 0.7; after it, AS 0.6.
    close(times(r, "Q"), [3.0952 + 0.2 / 0.75]);
    close(times(r, "attack"), [
      0,
      1.6667,
      3.0952,
      4.4286,
      4.4286 + 1 / 0.7,
      4.4286 + 1 / 0.7 + 1 / 0.6,
    ]);
    const rockets = r.trace.filter(
      (t) => t.damage.instance.sourceId === "JinxQAttack",
    );
    close(
      rockets.map((t) => t.time),
      [4.4286 + 0.25 / 0.7, 5.8571 + 0.25 / 0.6, 7.5238 + 0.25 / 0.6],
    );
    expect(amounts(r, "basic")).toEqual([60, 60, 60]);
  });
});

describe("Zap!", () => {
  it(
    "deals W's physical damage when the cast ends",
    { tags: ["JINX-004"] },
    () => {
      const r = run({ rotation: [{ action: "W" }] }, { maxDuration: 1 });
      expect(r.trace).toHaveLength(1);
      expect(r.trace[0]).toMatchObject({
        time: 0.6,
        damage: { postMitigation: 160 },
      });
      expect(r.trace[0]?.damage.instance).toMatchObject({
        type: "physical",
        ability: true,
      });
    },
  );

  it(
    "casts faster with bonus attack speed, down to the low end",
    { tags: ["JINX-009"] },
    () => {
      const at = (attackSpeed: number) =>
        run(
          { rotation: [{ action: "W" }], bonuses: [{ attackSpeed }] },
          { maxDuration: 1 },
        ).trace[0]?.time;
      // 0.6 − 0.01 × 0.4 / 0.1 = 0.56; +1000% would go below 0.4.
      expect(at(0.4)).toBeCloseTo(0.56, 9);
      expect(at(10)).toBe(0.4);
    },
  );
});

describe("Super Mega Death Rocket!", { tags: ["JINX-005"] }, () => {
  it("deals max damage plus R's percent of missing health", () => {
    const wound: Effect = {
      id: "Wound",
      init: (ctx) => {
        ctx.deal({
          type: "true",
          amount: 500,
          source: "item",
          sourceId: "Wound",
        });
      },
    };
    const r = run(
      {
        rotation: [
          { action: "R", when: [{ kind: "targetHealthBelow", fraction: 0.6 }] },
        ],
        bonuses: [{ attackDamage: 20 }],
        items: [wound],
      },
      { maxDuration: 1, target: { maxHealth: 1000 } },
    );
    // 300 + 100% bonus AD (20) + 20% × 500 missing
    expect(amounts(r, "JinxR")).toEqual([420]);
    expect(r.trace.at(-1)?.time).toBe(0.5);
  });
});

describe("default rotation", { tags: ["JINX-006", "ROT-007"] }, () => {
  it("is R when it would kill, W after an attack, otherwise attack", () => {
    expect(kit.rotation).toEqual([
      { action: "R", when: [{ kind: "wouldKill" }] },
      { action: "W", when: [{ kind: "afterAttack" }] },
      { action: "attack" },
    ]);
  });

  it("leaves out abilities without ranks", () => {
    expect(jinx(testJinx, 1, { Q: 1, W: 0, E: 0, R: 0 }).rotation).toEqual([
      { action: "attack" },
    ]);
  });
});
