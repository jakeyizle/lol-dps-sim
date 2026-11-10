import type { ItemData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { addItem } from "./build";

const item = (id: string, name: string, groups: string[] = []): ItemData => ({
  id,
  name,
  cost: 1000,
  stats: {},
  otherStats: {},
  values: {},
  calculations: {},
  groups,
});

const catalog = Object.fromEntries(
  [
    item("1", "Sword"),
    item("2", "Bow"),
    item("3", "Cloak"),
    item("4", "Dagger"),
    item("5", "Wand"),
    item("6", "Gem"),
    item("7", "Axe"),
    item("lw1", "Mortal Reminder", ["LastWhisper"]),
    item("lw2", "Lord Dominik's Regards", ["LastWhisper"]),
    item("b1", "Berserker's Greaves", ["Boots"]),
    item("b2", "Plated Steelcaps", ["Boots"]),
  ].map((i) => [i.id, i]),
);

describe("exclusive groups", { tags: ["ITEM-002"] }, () => {
  it("reject a second item from the same group, naming the conflict", () => {
    expect(addItem(["1", "lw1"], "lw2", catalog)).toEqual({
      ok: false,
      reason: "Lord Dominik's Regards can't be combined with Mortal Reminder",
    });
  });

  it("allow items from different groups", () => {
    expect(addItem(["lw1"], "b1", catalog)).toEqual({
      ok: true,
      items: ["lw1", "b1"],
    });
  });
});

describe("boots", { tags: ["ITEM-010"] }, () => {
  it("reject other boots, naming the boots in the build", () => {
    expect(addItem(["b1", "1"], "b2", catalog)).toEqual({
      ok: false,
      reason: "The build already has boots: Berserker's Greaves",
    });
  });
});

describe("item limit", { tags: ["ITEM-003"] }, () => {
  it("rejects a 7th item", () => {
    const six = ["1", "2", "3", "4", "5", "6"];
    const result = addItem(six, "7", catalog);
    expect(result.ok).toBe(false);
    expect(addItem(six.slice(0, 5), "7", catalog)).toEqual({
      ok: true,
      items: [...six.slice(0, 5), "7"],
    });
  });

  it("allows duplicates of items outside exclusive groups", () => {
    expect(addItem(["1"], "1", catalog)).toEqual({
      ok: true,
      items: ["1", "1"],
    });
  });
});

it("rejects unknown items", () => {
  expect(addItem([], "nope", catalog)).toEqual({
    ok: false,
    reason: "Unknown item nope",
  });
});
