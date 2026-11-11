import { parsePatch, type ItemData } from "@lol/data";
import { expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import targets from "../../../data/generated/26.22/targets.json";
import { testChampion } from "../../test/champions";
import { addItem } from "../build";
import type { Effect } from "../core/effects";
import { simulate } from "../core/sim";
import { equip } from ".";

const data = parsePatch({ champions, items, runes, constants, targets });
const item = (id: string): ItemData => {
  const i = data.items[id];
  if (!i) throw new Error(`no item ${id}`);
  return i;
};

it(
  "Kraken Slayer and BotRK deal physical damage",
  { tags: ["ITEM-004", "ITEM-005"] },
  () => {
    // magic resist only: physical damage is untouched
    const { bonuses, effects } = equip(
      [item("6672"), item("3153")],
      testChampion,
      data.constants,
    );
    const r = simulate(
      {
        champion: testChampion,
        level: 1,
        constants: data.constants,
        bonuses,
        items: effects,
      },
      { maxHealth: 1e6, defender: { armor: 0, magicResist: 300 } },
      { maxDuration: 6 },
    );
    for (const id of ["KrakenSlayer", "BladeOfTheRuinedKing"]) {
      const hit = r.trace.find((t) => t.damage.instance.sourceId === id);
      expect(hit?.damage.instance.type, id).toBe("physical");
      expect(hit?.damage.postMitigation, id).toBe(hit?.damage.preMitigation);
    }
  },
);

it(
  "build rules name the limit and ignore unknown items already in a build",
  {
    tags: ["ITEM-003"],
  },
  () => {
    const six = ["3031", "3036", "6672", "3153", "3085", "3046"];
    const full = addItem(six, "3094", data.items);
    expect(full).toEqual({
      ok: false,
      reason: "A build holds at most 6 items",
    });
    expect(addItem(["99999"], "3031", data.items).ok).toBe(true);
  },
);

it(
  "ranged Kraken Slayer counts attacks, not phantom hits",
  { tags: ["ITEM-004"] },
  () => {
    const phantom: Effect = {
      id: "Phantom",
      onHit: (ctx, attack) => {
        if (!attack.phantom) ctx.applyOnHit(attack, 0.05);
      },
    };
    const { bonuses, effects } = equip(
      [item("6672")],
      testChampion,
      data.constants,
    );
    const r = simulate(
      {
        champion: testChampion,
        level: 1,
        constants: data.constants,
        bonuses,
        items: [...effects, phantom],
      },
      { maxHealth: 1e6, defender: { armor: 0, magicResist: 0 } },
      { maxDuration: 4 },
    );
    const basic = r.trace.filter((t) => t.damage.instance.sourceId === "basic");
    const kraken = r.trace.filter(
      (t) => t.damage.instance.sourceId === "KrakenSlayer",
    );
    expect(kraken[0]?.time).toBe(basic[2]?.time);
  },
);

it(
  "Guinsoo's phantom stacks refresh with each hit",
  { tags: ["ITEM-016"] },
  () => {
    // slow attacks (2.2 s apart at full stacks, 3.3 s before): the two phantom stacks only last
    // until the third hit if each hit refreshes them
    const { bonuses, effects } = equip(
      [item("3124")],
      testChampion,
      data.constants,
    );
    const r = simulate(
      {
        champion: testChampion,
        level: 1,
        constants: data.constants,
        bonuses: [{ attackSpeed: -0.85 }, ...bonuses],
        items: effects,
      },
      { maxHealth: 1e6, defender: { armor: 0, magicResist: 0 } },
      { maxDuration: 30 },
    );
    const basics = r.trace.filter(
      (t) => t.damage.instance.sourceId === "basic",
    ).length;
    const procs = r.trace.filter(
      (t) => t.damage.instance.sourceId === "GuinsoosRageblade",
    ).length;
    // one proc per hit plus at least one phantom hit
    expect(procs).toBeGreaterThan(basics);
  },
);
