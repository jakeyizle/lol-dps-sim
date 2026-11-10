import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../App";
import { loadLatest } from "../data";
import { createAppStore } from "../model/store";

afterEach(cleanup);

const patch = loadLatest();
const name = (id: string) => patch.items[id]?.name ?? id;
const IE = name("3031");
const LDR = name("3036");
const MORTAL = name("3033");
const BERSERKERS = name("3006");
const STEELCAPS = name("3047");
const YUN_TAL = name("3032");

function setup() {
  let n = 0;
  const store = createAppStore(() => `b${String(++n)}`);
  render(<App store={store} patch={patch} />);
  fireEvent.click(screen.getByRole("button", { name: "Add build" }));
  return store;
}
const addItem = (itemName: string) => {
  fireEvent.change(screen.getByLabelText("Add item"), {
    target: { value: itemName },
  });
};
const stat = (label: string) =>
  document.querySelector(`[data-stat="${label}"]`)?.textContent;

describe("champion picker", { tags: ["BUILD-009"] }, () => {
  it("offers only champions with an implemented kit as attackers", () => {
    render(<App store={createAppStore()} patch={patch} />);
    const picker = screen.getByLabelText("Champion");
    const options = within(picker)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Jinx"]);
    expect(Object.keys(patch.champions).length).toBeGreaterThan(1);
  });
});

describe("stats panel", () => {
  it("lists the final stats", { tags: ["METRIC-007"] }, () => {
    setup();
    for (const label of [
      "AD",
      "Bonus AD",
      "Attack speed",
      "Crit chance",
      "Crit damage",
      "Armor pen",
      "Lethality",
      "Magic pen",
      "Ability haste",
      "Health",
      "Mana",
      "AP",
    ])
      expect(stat(label)).toBeTruthy();
  });

  it("updates when the build changes", { tags: ["BUILD-008"] }, () => {
    setup();
    expect(stat("Crit chance")).toBe("0.0%");
    addItem(IE);
    expect(stat("Crit chance")).toBe("25.0%");
    const before = stat("AD");
    fireEvent.change(screen.getByLabelText("Level"), {
      target: { value: "1" },
    });
    expect(stat("AD")).not.toBe(before);
  });
});

describe("long-term stacks", { tags: ["BUILD-007"] }, () => {
  it("shows an input only for the build's stacking items", () => {
    setup();
    addItem(IE);
    expect(screen.queryByLabelText(`${IE} stacks`)).toBeNull();
    expect(screen.queryByLabelText(`${YUN_TAL} stacks`)).toBeNull();
    addItem(YUN_TAL);
    const input = screen.getByLabelText(`${YUN_TAL} stacks`);
    fireEvent.change(input, { target: { value: "50" } });
    expect(stat("Crit chance")).not.toBe("25.0%");
  });
});

describe("item rules in the editor", () => {
  it(
    "reject a second item from an exclusive group, naming it",
    { tags: ["ITEM-002"] },
    () => {
      setup();
      addItem(LDR);
      addItem(MORTAL);
      expect(screen.getByRole("alert").textContent).toBe(
        `${MORTAL} can't be combined with ${LDR}`,
      );
    },
  );

  it(
    "reject other boots, naming the boots in the build",
    { tags: ["ITEM-010"] },
    () => {
      setup();
      addItem(BERSERKERS);
      addItem(STEELCAPS);
      expect(screen.getByRole("alert").textContent).toBe(
        `The build already has boots: ${BERSERKERS}`,
      );
    },
  );

  it("reject a 7th item", { tags: ["ITEM-003"] }, () => {
    const store = setup();
    for (const id of ["3031", "3036", "6672", "3153", "3046", "3094"])
      addItem(name(id));
    expect(store.getState().builds[0]?.items).toHaveLength(6);
    addItem(name("3072"));
    expect(screen.getByRole("alert").textContent).toMatch(/at most 6 items/);
    expect(store.getState().builds[0]?.items).toHaveLength(6);
  });
});
