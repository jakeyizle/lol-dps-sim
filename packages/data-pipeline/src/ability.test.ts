import { describe, expect, it } from "vitest";

import { fixture } from "../test/fixtures";
import { normalizeChampion } from "./champion";

const abilities = (id: Parameters<typeof fixture>[0]) => {
  const f = fixture(id);
  const { data } = normalizeChampion(f.ddragon, f.bin, id);
  return (data as { abilities: Record<string, Record<string, unknown>> })
    .abilities;
};

describe("ability values", { tags: ["DATA-004"] }, () => {
  it("hold ranks 1 to max rank, dropping the rank-0 entry", () => {
    // game file: Damage [-40, 10, 60, 110, 160, 210, 260]
    const w = abilities("Jinx").W;
    expect(w?.maxRank).toBe(5);
    expect((w?.values as Record<string, number[]>).Damage).toEqual([
      10, 60, 110, 160, 210,
    ]);
  });

  it("read cooldowns from rank 0 and mana costs from rank 1", () => {
    // cooldownTime [9, 8, 7, 6, 5, 4, 3]; mana [40, 45, 50, 55, 60, 65]
    const w = abilities("Jinx").W;
    expect(w?.cooldown).toEqual([8, 7, 6, 5, 4]);
    expect(w?.cost).toEqual([40, 45, 50, 55, 60]);
    expect(w?.castTime).toBe(0.25);
  });

  it("give ultimates 3 ranks", () => {
    // cooldownTime [85, 85, 65, 45, …]
    const r = abilities("Jinx").R;
    expect(r?.maxRank).toBe(3);
    expect(r?.cooldown).toEqual([85, 65, 45]);
    expect((r?.values as Record<string, number[]>).PercentDamage).toEqual([
      25, 30, 35,
    ]);
  });

  it("find spells whose names differ from the champion's (Ashe W = Volley)", () => {
    expect(abilities("Ashe").W?.maxRank).toBe(5);
  });

  it("round float noise", () => {
    // RocketTAD 1.100000023841858
    expect(
      (abilities("Jinx").Q?.values as Record<string, number[]>).RocketTAD,
    ).toEqual([1.1, 1.1, 1.1, 1.1, 1.1]);
  });
});

it("treats a value without a list as zero", { tags: ["DATA-004"] }, () => {
  // Vayne Q's CanBonusDamageCrit has no `values`
  expect(
    (abilities("Vayne").Q?.values as Record<string, number[]>)
      .CanBonusDamageCrit,
  ).toEqual([0, 0, 0, 0, 0]);
});

it(
  "read effect amounts as Effect1, Effect2 … by rank",
  { tags: ["DATA-004"] },
  () => {
    // game file: KaisaW mEffectAmount[0] = [30, 30, 55, 80, 105, 130, 130]
    const w = abilities("Kaisa").W?.values as Record<string, number[]>;
    expect(w.Effect1).toEqual([30, 55, 80, 105, 130]);
    expect(w.Effect4).toEqual([2, 2, 2, 2, 2]);
    expect(w.Effect6).toBeUndefined();
  },
);
