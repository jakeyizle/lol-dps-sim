import { parsePatch, type ItemData } from "@lol/data";
import { expect, it } from "vitest";

import champions from "../../data/generated/26.22/champions.json";
import constants from "../../data/generated/26.22/constants.json";
import items from "../../data/generated/26.22/items.json";
import runes from "../../data/generated/26.22/runes.json";
import targets from "../../data/generated/26.22/targets.json";
import { testChampion } from "../test/champions";
import { KITS } from "./champions";
import type { Effect } from "./core/effects";
import { simulate, type SimAbility } from "./core/sim";
import { equip } from "./items";
import { runeEffects } from "./runes";

/**
 * `analyze` runs the fight and the DPS run with the same effect objects, so every
 * stateful effect must start each fight fresh (cooldowns, counters, pending activations).
 */
const data = parsePatch({ champions, items, runes, constants, targets });
const item = (id: string): ItemData => {
  const i = data.items[id];
  if (!i) throw new Error(`no item ${id}`);
  return i;
};
const page = (keystone: number) => {
  const precision = data.trees.find((t) => t.key === "Precision");
  const domination = data.trees.find((t) => t.key === "Domination");
  const tree = [precision, domination].find((t) =>
    t?.slots[0]?.includes(keystone),
  );
  if (!tree || !precision || !domination) throw new Error("no tree");
  return {
    primary: tree.id,
    keystone,
    primaryRunes: [],
    secondary: tree === precision ? domination.id : precision.id,
    secondaryRunes: [],
    shards: [],
  };
};
const spell = (id: string): SimAbility => ({
  id,
  castTime: 0.25,
  cooldown: 5,
  cost: 0,
  damage: {
    type: "physical",
    amount: 50,
    source: "ability",
    sourceId: id,
    ability: true,
  },
});

function twice(effects: Effect[], bonus = {}) {
  const run = () =>
    simulate(
      {
        champion: testChampion,
        level: 18,
        constants: data.constants,
        bonuses: [{ attackSpeed: 0.6, critChance: 0.5, ...bonus }],
        items: effects,
        abilities: [spell("Q"), spell("R")],
        rotation: [
          { action: "R" },
          { action: "Q", when: [{ kind: "afterAttack" }] },
          { action: "attack" },
        ],
      },
      { maxHealth: 1e9, defender: { armor: 50, magicResist: 50 } },
      { maxDuration: 12 },
    );
  return [run(), run()].map((r) =>
    r.trace.map((t) => [
      t.time,
      t.damage.instance.sourceId,
      Math.round(t.damage.postMitigation * 1e6),
    ]),
  );
}

it("item effects start every fight fresh", { tags: ["SIM-009"] }, () => {
  // Yun Tal, Fiendhunter, Essence Reaver, Terminus
  for (const id of ["3032", "2512", "3508", "3302"]) {
    const { effects } = equip([item(id)], testChampion, data.constants);
    const [first, second] = twice(effects);
    expect(second, id).toEqual(first);
  }
});

it("keystones start every fight fresh", { tags: ["SIM-009"] }, () => {
  // Press the Attack, Hail of Blades, Conqueror
  for (const keystone of [8005, 9923, 8010]) {
    const effects = runeEffects(page(keystone), data.runes, testChampion);
    expect(effects.map((e) => e.id)).toHaveLength(1);
    const [first, second] = twice(effects);
    expect(second, String(keystone)).toEqual(first);
  }
});

it("champion kits start every fight fresh", { tags: ["SIM-009"] }, () => {
  for (const id of ["Jinx", "Caitlyn", "Ashe", "Kaisa", "Vayne"]) {
    const champion = data.champions[id];
    const make = KITS[id];
    if (!champion || !make) throw new Error(id);
    const kit = make(champion, 18);
    const run = () =>
      simulate(
        {
          champion,
          level: 18,
          constants: data.constants,
          bonuses: [{ attackDamage: 60, abilityPower: 100 }],
          abilities: kit.abilities,
          kit: kit.kit,
          rotation: kit.rotation,
        },
        { maxHealth: 1e9, defender: { armor: 50, magicResist: 50 } },
        { maxDuration: 12 },
      ).trace.map((t) => [t.time, t.damage.instance.sourceId, t.buffs.join()]);
    expect(run(), id).toEqual(run());
  }
});
