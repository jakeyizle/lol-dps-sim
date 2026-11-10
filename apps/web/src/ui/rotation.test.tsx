import { analyze, KITS } from "@lol/engine";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { App } from "../App";
import { loadLatest } from "../data";
import { defaultSettings, toSimulation } from "../model/simulation";
import { createAppStore } from "../model/store";
import { defaultDummy } from "../model/target";
import { inlineRunner } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();

function setup(champion: string) {
  const store = createAppStore();
  render(
    <App
      store={store}
      patch={patch}
      runner={inlineRunner(patch)}
      debounceMs={0}
    />,
  );
  fireEvent.change(screen.getByLabelText("Champion"), {
    target: { value: champion },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add build" }));
  const build = () => {
    const b = store.getState().builds[0];
    if (!b) throw new Error("no build");
    return b;
  };
  return { store, build };
}
const options = (label: string) =>
  within(screen.getByLabelText(label))
    .getAllByRole("option")
    .map((o) => (o as HTMLOptionElement).value);

it(
  "edits to the rotation are used by later simulations",
  { tags: ["ROT-008"] },
  () => {
    const { build } = setup("Caitlyn");
    // add R as a new last rule, then move it to the top
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    fireEvent.change(screen.getByLabelText("Rule 5 action"), {
      target: { value: "R" },
    });
    for (let i = 5; i > 1; i--)
      fireEvent.click(
        screen.getByRole("button", { name: `Move rule ${String(i)} up` }),
      );
    // only once the target is low
    fireEvent.change(screen.getByLabelText("Rule 1 add condition"), {
      target: { value: "targetHealthBelow" },
    });
    fireEvent.change(screen.getByLabelText("Rule 1 condition 1 health %"), {
      target: { value: "40" },
    });
    expect(build().rotation).toEqual([
      { action: "R", when: [{ kind: "targetHealthBelow", fraction: 0.4 }] },
      { action: "W" },
      { action: "E" },
      { action: "Q", when: [{ kind: "afterAttack" }] },
      { action: "attack" },
    ]);
    const sim = toSimulation(build(), defaultDummy, patch, defaultSettings);
    expect(sim.attacker.rotation).toEqual(build().rotation);
    const casts = analyze(sim.attacker, sim.target, sim.options).fight.actions;
    expect(casts.some((a) => a.action === "R")).toBe(true);

    // removing a rule and a condition
    fireEvent.click(
      screen.getByRole("button", { name: "Remove rule 1 condition 1" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove rule 2" }));
    expect(build().rotation?.map((r) => r.action)).toEqual([
      "R",
      "E",
      "Q",
      "attack",
    ]);
  },
);

it(
  "offers only the champion's actions, supported conditions and its stack buffs",
  { tags: ["ROT-009"] },
  () => {
    setup("Jinx");
    expect(options("Rule 1 action")).toEqual(["attack", "Q", "W", "R"]);
    expect(options("Rule 1 add condition")).toEqual([
      "",
      "afterAttack",
      "targetHealthBelow",
      "wouldKill",
      "minStacks",
      "minMana",
    ]);
    fireEvent.change(screen.getByLabelText("Rule 1 add condition"), {
      target: { value: "minStacks" },
    });
    const jinx = patch.champions.Jinx;
    const kit = jinx && KITS.Jinx?.(jinx, 18);
    expect(options("Rule 1 condition 2 buff")).toEqual(
      kit?.buffs.map((b) => b.id),
    );
  },
);

it("resets to the champion's default", { tags: ["ROT-010"] }, () => {
  const { build } = setup("Ashe");
  fireEvent.click(screen.getByRole("button", { name: "Remove rule 1" }));
  expect(build().rotation).toHaveLength(2);
  expect(screen.getByText("(edited)")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
  expect(build().rotation).toBeUndefined();
  expect(screen.getByText("(default)")).toBeDefined();
  expect(options("Rule 1 action")).toContain("Q");
});
