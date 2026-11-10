import { parsePatch, type ItemData } from "@lol/data";
import { expect, it } from "vitest";

import champions from "../../data/generated/26.22/champions.json";
import constants from "../../data/generated/26.22/constants.json";
import items from "../../data/generated/26.22/items.json";
import runes from "../../data/generated/26.22/runes.json";
import targets from "../../data/generated/26.22/targets.json";
import { DEFAULT_RUNES, KITS } from "./champions";
import { simulateMany } from "./core/many";
import type { SimTarget } from "./core/sim";
import { equip } from "./items";
import { runeEffects, runeStats } from "./runes";

const data = parsePatch({ champions, items, runes, constants, targets });
const jinx = data.champions.Jinx;
const kitOf = KITS.Jinx;
if (!jinx || !kitOf) throw new Error("no Jinx");

/** CMP-005 fixture: four full Jinx builds × three targets, 200 RNG runs each. */
const BUILDS: string[][] = [
  ["3031", "6672", "3036"], // IE, Kraken, LDR
  ["3124", "3153", "3091"], // Guinsoo, BotRK, Wit's End
  ["3032", "3031", "3046", "3036"], // Yun Tal, IE, Phantom Dancer, LDR
  ["6676", "3094", "3031", "3072"], // Collector, RFC, IE, Bloodthirster
];
const TARGETS: SimTarget[] = [
  { maxHealth: 2200, defender: { armor: 80, magicResist: 50 } },
  { maxHealth: 3600, defender: { armor: 150, magicResist: 80 } },
  { maxHealth: 5000, defender: { armor: 250, magicResist: 120 } },
];
const page = DEFAULT_RUNES.Jinx;

const BUDGET_MS = 2000;

// Mutation runs instrument the engine, so their timings say nothing about the budget.
const instrumented = "__stryker__" in globalThis;

it.skipIf(instrumented)(
  "4 builds × 3 targets × 200 RNG runs finish within the budget",
  { tags: ["CMP-005"], timeout: 30_000 },
  () => {
    const kit = kitOf(jinx, 18);
    const attackers = BUILDS.map((ids) => {
      const list = ids
        .map((id) => data.items[id])
        .filter((i): i is ItemData => i !== undefined);
      expect(list).toHaveLength(ids.length);
      const { bonuses, effects } = equip(list, jinx, data.constants);
      return {
        champion: jinx,
        level: 18,
        constants: data.constants,
        bonuses: [...bonuses, ...(page ? runeStats(page, data.runes, 18) : [])],
        runes: page ? runeEffects(page, data.runes, jinx) : [],
        abilities: kit.abilities,
        kit: kit.kit,
        items: effects,
        rotation: kit.rotation,
      };
    });
    const start = Date.now();
    let runs = 0;
    for (const attacker of attackers)
      for (const target of TARGETS)
        runs += simulateMany(attacker, target, {
          critMode: "rng",
          runs: 200,
          maxDuration: 20,
        }).runs;
    const elapsed = Date.now() - start;
    expect(runs).toBe(4 * 3 * 200);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  },
);
