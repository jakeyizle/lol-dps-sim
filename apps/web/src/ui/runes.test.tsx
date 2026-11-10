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
import { inlineRunner } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();
const treeId = (key: string) => patch.trees.find((t) => t.key === key)?.id;

function setup() {
  const store = createAppStore();
  render(
    <App
      store={store}
      patch={patch}
      runner={inlineRunner(patch)}
      debounceMs={0}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add build" }));
  return store;
}
const page = (store: ReturnType<typeof setup>) =>
  store.getState().builds[0]?.runes;

describe("rune editor", { tags: ["RUNE-001"] }, () => {
  it("starts from the kit's page and keeps the page valid when trees change", () => {
    const store = setup();
    expect(screen.queryByRole("alert")).toBeNull();
    const domination = treeId("Domination");
    fireEvent.change(screen.getByLabelText("Primary tree"), {
      target: { value: String(domination) },
    });
    const keystones = within(screen.getByLabelText("Keystone"))
      .getAllByRole("option")
      .map((o) => Number((o as HTMLOptionElement).value));
    const tree = patch.trees.find((t) => t.id === domination);
    expect(keystones).toEqual(tree?.slots[0]);
    expect(page(store)?.primary).toBe(domination);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("flags a third secondary rune", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Secondary row 1"), {
      target: {
        value: screen
          .getByLabelText("Secondary row 1")
          .querySelector("option:not([value=''])")
          ?.getAttribute("value"),
      },
    });
    expect(screen.getByRole("alert").textContent).toMatch(/two runes/);
  });
});

it("shards change the stats panel", { tags: ["RUNE-002"] }, () => {
  setup();
  const as = () =>
    document.querySelector('[data-stat="Attack speed"]')?.textContent;
  const before = as();
  // offense shard: attack speed → adaptive
  fireEvent.change(screen.getByLabelText("Shard 1"), {
    target: { value: "5008" },
  });
  expect(as()).not.toBe(before);
});

it("Legend stacks are set in the editor", { tags: ["RUNE-009"] }, () => {
  const store = setup();
  const as = () =>
    document.querySelector('[data-stat="Attack speed"]')?.textContent;
  const before = as();
  // the default Jinx page has Legend: Alacrity
  fireEvent.change(screen.getByLabelText(/Legend: Alacrity stacks/), {
    target: { value: "10" },
  });
  expect(store.getState().builds[0]?.stacks["9104"]).toBe(10);
  expect(as()).not.toBe(before);
});
