import { parsePatch, type ItemData } from "@lol/data";
import { expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import targets from "../../../data/generated/26.22/targets.json";
import { testChampion } from "../../test/champions";
import { addItem } from "../build";
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
