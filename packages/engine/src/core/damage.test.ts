import { describe, expect, it } from "vitest";

import {
  absorb,
  effectiveResistance,
  resolveDamage,
  type Attacker,
  type CritMode,
  type DamageInstance,
  type Defender,
} from "./damage";

const attacker: Attacker = {
  critChance: 0,
  critDamage: 2,
  lethality: 0,
  armorPenPercent: 0,
  magicPenFlat: 0,
  magicPenPercent: 0,
};
const noArmor: Defender = { armor: 0, magicResist: 0 };
const EV: CritMode = { kind: "expected" };

const hit = (over: Partial<DamageInstance> = {}): DamageInstance => ({
  type: "physical",
  amount: 200,
  source: "attack",
  sourceId: "basic",
  ...over,
});

const post = (
  instance: DamageInstance,
  defender: Defender = noArmor,
  a: Partial<Attacker> = {},
  critMode: CritMode = EV,
  amplifiers: number[] = [],
) =>
  resolveDamage({
    instance,
    attacker: { ...attacker, ...a },
    defender,
    critMode,
    amplifiers,
  }).postMitigation;

describe("resistances", () => {
  it("armor reduces physical damage", { tags: ["DMG-001"] }, () => {
    expect(post(hit(), { armor: 100, magicResist: 0 })).toBeCloseTo(100, 9);
    expect(post(hit(), { armor: 50, magicResist: 0 })).toBeCloseTo(
      200 / 1.5,
      9,
    );
  });

  it("magic resist reduces magic damage", { tags: ["DMG-002"] }, () => {
    expect(
      post(hit({ type: "magic" }), { armor: 0, magicResist: 100 }),
    ).toBeCloseTo(100, 9);
    // armor doesn't affect magic damage
    expect(
      post(hit({ type: "magic" }), { armor: 300, magicResist: 0 }),
    ).toBeCloseTo(200, 9);
  });

  it("negative resistances increase damage", { tags: ["DMG-003"] }, () => {
    // 2 − 100 / (100 + 25) = 1.2
    expect(post(hit(), { armor: -25, magicResist: 0 })).toBeCloseTo(240, 9);
  });

  it("true damage ignores resistances", { tags: ["DMG-004"] }, () => {
    expect(post(hit({ type: "true" }), { armor: 300, magicResist: 300 })).toBe(
      200,
    );
  });
});

describe("reduction and penetration", () => {
  it(
    "apply in order: flat red, % red, % pen, lethality",
    { tags: ["DMG-005"] },
    () => {
      // (100 − 10) × 0.8 × 0.7 − 5 = 45.4
      expect(
        effectiveResistance({
          base: 100,
          reductionFlat: 10,
          reductionPercent: 0.2,
          penPercent: 0.3,
          penFlat: 5,
        }),
      ).toBeCloseTo(45.4, 9);
      // a different order would give a different value: ((100 × 0.8) − 10) × 0.7 − 5 = 44
      const resolved = post(
        hit(),
        {
          armor: 100,
          magicResist: 0,
          armorReductionFlat: 10,
          armorReductionPercent: 0.2,
        },
        { armorPenPercent: 0.3, lethality: 5 },
      );
      expect(resolved).toBeCloseTo(200 * (100 / 145.4), 9);
    },
  );

  it("penetration cannot take armor below zero", { tags: ["DMG-006"] }, () => {
    expect(effectiveResistance({ base: 10, penFlat: 20 })).toBe(0);
    expect(post(hit(), { armor: 10, magicResist: 0 }, { lethality: 20 })).toBe(
      200,
    );
  });

  it("reduction can take armor below zero", { tags: ["DMG-007"] }, () => {
    expect(effectiveResistance({ base: 10, reductionFlat: 20 })).toBe(-10);
    // penetration then does nothing
    expect(
      effectiveResistance({ base: 10, reductionFlat: 20, penPercent: 0.5 }),
    ).toBe(-10);
  });

  it("magic penetration uses magic stats", { tags: ["DMG-005"] }, () => {
    // (100 × 0.6) − 10 = 50 → 200 × 100/150
    expect(
      post(
        hit({ type: "magic" }),
        { armor: 0, magicResist: 100 },
        { magicPenPercent: 0.4, magicPenFlat: 10, lethality: 99 },
      ),
    ).toBeCloseTo(200 / 1.5, 9);
  });
});

describe("crits", () => {
  const critable = hit({ critable: true, autoAttack: true });

  it("RNG crits multiply by total crit damage", { tags: ["DMG-008"] }, () => {
    const crit = { kind: "roll", crit: true } as const;
    expect(post(critable, noArmor, { critDamage: 2.4 }, crit)).toBeCloseTo(
      480,
      9,
    );
    expect(
      post(
        critable,
        noArmor,
        { critDamage: 2.4 },
        { kind: "roll", crit: false },
      ),
    ).toBe(200);
  });

  it("expected value averages crits", { tags: ["DMG-009"] }, () => {
    // 1 + 0.5 × (2 − 1) = 1.5
    expect(post(critable, noArmor, { critChance: 0.5 })).toBeCloseTo(300, 9);
    const r = resolveDamage({
      instance: critable,
      attacker: { ...attacker, critChance: 0.5 },
      defender: noArmor,
      critMode: EV,
    });
    expect(r.crit).toBe("averaged");
  });

  it("on-hit damage doesn't crit", { tags: ["DMG-013"] }, () => {
    const onHit = hit({ type: "magic", onHit: true, sourceId: "item" });
    expect(post(onHit, noArmor, { critChance: 1 })).toBe(200);
    expect(
      post(onHit, noArmor, { critChance: 1 }, { kind: "roll", crit: true }),
    ).toBe(200);
  });

  it(
    "crit damage reduction applies to the crit part in expected-value mode",
    { tags: ["DMG-014"] },
    () => {
      // T × (1 − X) = 2 × 0.8 = 1.6; 1 + 0.5 × 0.6 = 1.3
      const randuins: Defender = { ...noArmor, critDamageReduction: 0.2 };
      expect(post(critable, randuins, { critChance: 0.5 })).toBeCloseTo(260, 9);
      // no effect at 0% crit chance
      expect(post(critable, randuins)).toBe(200);
    },
  );
});

describe("amplifiers", { tags: ["DMG-010"] }, () => {
  it("apply before resistances", () => {
    const r = resolveDamage({
      instance: hit(),
      attacker,
      defender: { armor: 100, magicResist: 0 },
      critMode: EV,
      amplifiers: [0.1],
    });
    expect(r.preMitigation).toBeCloseTo(220, 9);
    expect(r.postMitigation).toBeCloseTo(110, 9);
  });

  it("multiply together", () => {
    expect(post(hit(), noArmor, {}, EV, [0.1, 0.2])).toBeCloseTo(264, 9);
  });
});

describe("tags", { tags: ["DMG-011"] }, () => {
  it("keep type, source and flags on the result", () => {
    const instance = hit({
      type: "magic",
      source: "item",
      sourceId: "KrakenSlayer",
      onHit: true,
    });
    const r = resolveDamage({
      instance,
      attacker,
      defender: noArmor,
      critMode: EV,
    });
    expect(r.instance).toBe(instance);
    expect(r.crit).toBe("notCritable");
  });
});

describe("target reductions", () => {
  it("auto-attack-only reductions skip abilities", () => {
    const steelcaps: Defender = {
      ...noArmor,
      reductions: [{ appliesTo: "autoAttack", fraction: 0.1 }],
    };
    expect(post(hit({ autoAttack: true }), steelcaps)).toBeCloseTo(180, 9);
    expect(post(hit({ ability: true }), steelcaps)).toBe(200);
  });
});

describe("shields", () => {
  it("absorb damage before health", { tags: ["DMG-012"] }, () => {
    expect(absorb([{ amount: 50, blocks: "all" }], 80, "physical")).toEqual({
      shields: [],
      absorbed: 50,
      toHealth: 30,
    });
    expect(absorb([{ amount: 100, blocks: "all" }], 80, "true")).toEqual({
      shields: [{ amount: 20, blocks: "all" }],
      absorbed: 80,
      toHealth: 0,
    });
  });

  it("typed shields only absorb their type", { tags: ["DMG-015"] }, () => {
    const maw = [{ amount: 100, blocks: "magic" as const }];
    expect(absorb(maw, 80, "physical")).toEqual({
      shields: maw,
      absorbed: 0,
      toHealth: 80,
    });
    expect(absorb(maw, 80, "true").toHealth).toBe(80);
    expect(absorb(maw, 80, "magic").toHealth).toBe(0);
  });
});
