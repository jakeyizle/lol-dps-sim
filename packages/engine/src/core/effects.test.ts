import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import type { DamageInstance } from "./damage";
import {
  empoweredAttack,
  everyNthAttack,
  stackingBuff,
  type BuffSpec,
  type Effect,
} from "./effects";
import { simulate, type SimAttacker, type SimTarget } from "./sim";

/** AD 60, +40% AS → 0.8 attacks/s: attacks start at 0, 1.25, 2.5 …, land 0.25 s later. */
const base: SimAttacker = {
  champion: testChampion,
  level: 1,
  constants: testConstants,
  bonuses: [{ attackSpeed: 0.4 }],
};
const dummy: SimTarget = {
  maxHealth: 1e9,
  defender: { armor: 0, magicResist: 0 },
};

const run = (
  over: Partial<SimAttacker>,
  opts: { maxDuration?: number; target?: Partial<SimTarget> } = {},
) =>
  simulate(
    { ...base, ...over },
    { ...dummy, ...opts.target },
    {
      maxDuration: opts.maxDuration ?? 5,
    },
  );

const bonus = (sourceId: string, amount = 10): DamageInstance => ({
  type: "true",
  amount,
  source: "item",
  sourceId,
  onHit: true,
});

const amounts = (r: ReturnType<typeof run>, sourceId: string) =>
  r.trace
    .filter((t) => t.damage.instance.sourceId === sourceId)
    .map((t) => t.damage.postMitigation);

describe("hook order", { tags: ["SIM-024"] }, () => {
  it("runs kit, then items in build order, then runes", () => {
    const log: string[] = [];
    const logger = (id: string): Effect => ({
      id,
      init: () => log.push(`init:${id}`),
      onAttackLaunch: () => log.push(`launch:${id}`),
      onHit: () => log.push(`hit:${id}`),
    });
    run(
      {
        runes: [logger("rune")],
        items: [logger("item1"), logger("item2")],
        kit: [logger("kit")],
      },
      { maxDuration: 0.5 },
    );
    const order = ["kit", "item1", "item2", "rune"];
    expect(log).toEqual([
      ...order.map((id) => `init:${id}`),
      ...order.map((id) => `launch:${id}`),
      ...order.map((id) => `hit:${id}`),
    ]);
  });
});

describe("on-hit effects", { tags: ["ITEM-008"] }, () => {
  const onHit: Effect = {
    id: "OnHit",
    onHit: (ctx) => {
      ctx.deal(bonus("OnHit"));
    },
  };

  it("apply exactly once per landed attack", () => {
    // Landings at 0.25, 1.5, 2.75, 4.0; the attack at 5.0 lands after the end.
    const r = run({ items: [onHit] });
    const attacks = r.trace.filter((t) => t.damage.instance.autoAttack);
    expect(attacks).toHaveLength(4);
    expect(amounts(r, "OnHit")).toEqual([10, 10, 10, 10]);
    r.trace.forEach((t, i) => {
      if (t.damage.instance.sourceId === "OnHit")
        expect(r.trace[i - 1]?.time).toBe(t.time);
    });
  });

  it("don't crit when the attack crits", () => {
    const r = simulate(
      { ...base, bonuses: [{ critChance: 1 }], items: [onHit] },
      dummy,
      { maxDuration: 2, critMode: "rng", seed: 7 },
    );
    const crits = r.trace.filter((t) => t.damage.crit === "crit");
    expect(crits.length).toBeGreaterThan(0);
    expect(amounts(r, "OnHit").every((a) => a === 10)).toBe(true);
  });

  it("stop once the target is dead", () => {
    const killer: Effect = {
      id: "Killer",
      onHit: (ctx) => {
        ctx.deal(bonus("Killer", 1000));
      },
    };
    const r = run({ items: [killer, onHit] }, { target: { maxHealth: 500 } });
    expect(r.killed).toBe(true);
    expect(amounts(r, "OnHit")).toEqual([]);
    expect(r.trace).toHaveLength(2);
  });
});

describe("hooks", () => {
  it("modifyOutgoing amplifies and modifyIncoming reduces damage", () => {
    const r = run(
      { items: [{ id: "Amp", modifyOutgoing: () => 0.1 }] },
      {
        maxDuration: 0.5,
        target: { effects: [{ id: "Plate", modifyIncoming: () => 0.5 }] },
      },
    );
    expect(amounts(r, "basic")).toEqual([33]);
  });

  it("modifyStats adds stats", () => {
    const r = run(
      { kit: [{ id: "Strong", modifyStats: () => ({ attackDamage: 40 }) }] },
      { maxDuration: 0.5 },
    );
    expect(amounts(r, "basic")).toEqual([100]);
  });

  it("schedule runs a callback later", () => {
    const r = run(
      {
        kit: [
          {
            id: "Delayed",
            init: (ctx) => {
              ctx.schedule(1, (later) => {
                later.deal(bonus("Delayed"));
              });
            },
          },
        ],
      },
      { maxDuration: 2 },
    );
    expect(
      r.trace.find((t) => t.damage.instance.sourceId === "Delayed")?.time,
    ).toBe(1);
  });

  it("onAbilityCast runs when the cast ends", () => {
    const r = run(
      {
        abilities: [{ id: "Q", castTime: 0.5, cooldown: 100, cost: 0 }],
        policy: (s) => (s.isReady("Q") ? "Q" : "attack"),
        kit: [
          {
            id: "Kit",
            onAbilityCast: (ctx, id) => {
              ctx.deal(bonus(id));
            },
          },
        ],
      },
      { maxDuration: 1 },
    );
    expect(r.trace[0]).toMatchObject({ time: 0.5 });
    expect(amounts(r, "Q")).toEqual([10]);
  });
});

describe("helpers", () => {
  it("everyNthAttack applies on every Nth attack", () => {
    const third = everyNthAttack({
      id: "Third",
      n: 3,
      at: "hit",
      apply: (ctx) => {
        ctx.deal(bonus("Third"));
      },
    });
    // 7 landings in 9 s: the 3rd and 6th get the bonus.
    const r = run({ items: [third] }, { maxDuration: 9 });
    const procs = r.trace.filter((t) => t.damage.instance.sourceId === "Third");
    expect(procs.map((t) => t.time)).toEqual([2.75, 6.5]);
  });

  it("everyNthAttack resets its count after its duration", () => {
    const third = everyNthAttack({
      id: "Third",
      n: 3,
      at: "launch",
      duration: 1,
      apply: (ctx, attack) => {
        attack.extra.push(bonus("Third"));
      },
    });
    // Attacks are 1.25 s apart, so the count never reaches 3.
    expect(
      amounts(run({ items: [third] }, { maxDuration: 9 }), "Third"),
    ).toEqual([]);
  });

  it("stackingBuff adds a stack per trigger, up to its max", () => {
    const fury: BuffSpec = {
      id: "Fury",
      maxStacks: 2,
      duration: Infinity,
      refreshOnStack: true,
      stats: { attackDamage: 10 },
    };
    const r = run({ kit: [stackingBuff(fury, "hit")] });
    expect(amounts(r, "basic")).toEqual([60, 70, 80, 80]);
  });

  it("empoweredAttack changes the next attack and consumes the buff", () => {
    const charged: BuffSpec = {
      id: "Charged",
      maxStacks: 1,
      duration: Infinity,
      refreshOnStack: false,
    };
    const r = run(
      {
        kit: [
          {
            id: "Charge",
            init: (ctx) => {
              ctx.addBuff(charged);
            },
          },
          empoweredAttack({
            id: "Empowered",
            buff: "Charged",
            apply: (_ctx, attack) => {
              attack.extra.push(bonus("Empowered", 50));
            },
          }),
        ],
      },
      { maxDuration: 3 },
    );
    expect(amounts(r, "Empowered")).toEqual([50]);
    expect(r.trace[1]).toMatchObject({ time: 0.25 });
  });
});
