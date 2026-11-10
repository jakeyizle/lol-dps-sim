import type { ItemData, PatchData } from "@lol/data";
import {
  equip,
  KITS,
  type SimAttacker,
  type SimOptions,
  type SimTarget,
} from "@lol/engine";

import { ranksOf, type Build } from "./build";

/** TGT-002: a custom dummy with entered stats. */
export interface DummyTarget {
  kind: "dummy";
  health: number;
  armor: number;
  magicResist: number;
}

export interface Settings {
  /** Minutes (BUILD-013). */
  gameTime: number;
  maxDuration: number;
  critMode: "expected" | "rng";
  dpsWindows: number[];
}

export const defaultSettings: Settings = {
  gameTime: 30,
  maxDuration: 20,
  critMode: "expected",
  dpsWindows: [3, 6, 10],
};

export const defaultDummy: DummyTarget = {
  kind: "dummy",
  health: 3000,
  armor: 100,
  magicResist: 50,
};

/** Builds the engine's inputs for one build against one target. */
export function toSimulation(
  build: Build,
  target: DummyTarget,
  patch: PatchData,
  settings: Settings,
): {
  attacker: SimAttacker;
  target: SimTarget;
  options: SimOptions & { dpsWindows: number[] };
} {
  const champion = patch.champions[build.champion];
  const kitFactory = KITS[build.champion];
  if (!champion || !kitFactory)
    throw new Error(`${build.champion} has no implemented kit`);
  const kit = kitFactory(champion, build.level, ranksOf(build, champion));
  const items = build.items
    .map((id) => patch.items[id])
    .filter((i): i is ItemData => i !== undefined);
  const { bonuses, effects } = equip(
    items,
    champion,
    patch.constants,
    build.stacks,
  );
  return {
    attacker: {
      champion,
      level: build.level,
      constants: patch.constants,
      bonuses,
      abilities: kit.abilities,
      kit: kit.kit,
      items: effects,
      rotation: build.rotation ?? kit.rotation,
      healthFraction: build.healthFraction,
    },
    target: {
      maxHealth: target.health,
      defender: { armor: target.armor, magicResist: target.magicResist },
      champion: false,
    },
    options: {
      maxDuration: settings.maxDuration,
      critMode: settings.critMode,
      gameTime: settings.gameTime,
      dpsWindows: settings.dpsWindows,
    },
  };
}
