import { analyze } from "@lol/engine";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../App";
import { loadLatest } from "../data";
import { newBuild } from "../model/build";
import { defaultSettings, toSimulation } from "../model/simulation";
import { createAppStore } from "../model/store";
import { defaultDummy, shippedPresets } from "../model/target";
import { inlineRunner } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();

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
const toChampion = (id: string) => {
  fireEvent.change(screen.getByLabelText("Target kind"), {
    target: { value: "champion" },
  });
  fireEvent.change(screen.getByLabelText("Target champion"), {
    target: { value: id },
  });
};
const targetStat = (key: string) =>
  Number(
    document
      .querySelector(`[data-target-stat="${key}"]`)
      ?.textContent.replace(/,/g, ""),
  );

it(
  "a dummy's damage reduction removes that share of damage",
  { tags: ["TGT-002"] },
  () => {
    const build = newBuild("b", "Jinx");
    const damage = (damageReduction: number) => {
      const sim = toSimulation(
        build,
        { ...defaultDummy, health: 1e9, damageReduction },
        patch,
        defaultSettings,
      );
      return analyze(sim.attacker, sim.target, sim.options).fight.trace.reduce(
        (sum, t) => sum + t.toHealth,
        0,
      );
    };
    expect(damage(0.25)).toBeCloseTo(damage(0) * 0.75, 6);
  },
);

describe("champion targets", () => {
  it(
    "any champion can be a target, marked stats only without a defensive kit",
    { tags: ["BUILD-009"] },
    async () => {
      setup();
      toChampion("Garen");
      const options = within(screen.getByLabelText("Target champion"))
        .getAllByRole("option")
        .map((o) => o.textContent);
      expect(options).toHaveLength(Object.keys(patch.targets).length);
      expect(options).toContain("Garen (stats only)");
      expect(screen.getByTestId("stats-only").textContent).toMatch(/Garen/);
      await waitFor(() => {
        expect(screen.getByTestId("results-target").textContent).toBe(
          "vs Garen (stats only)",
        );
      });
      // the attacker picker still offers only implemented kits
      expect(
        within(screen.getByLabelText("Champion"))
          .getAllByRole("option")
          .map((o) => (o as HTMLOptionElement).value),
      ).not.toContain("Garen");
    },
  );

  it("use their level and items", { tags: ["TGT-001"] }, () => {
    setup();
    toChampion("Garen");
    const armor = targetStat("armor");
    fireEvent.change(screen.getByLabelText("Add target item"), {
      target: { value: "3075" },
    });
    expect(targetStat("armor")).toBeGreaterThan(armor);
    fireEvent.change(screen.getByLabelText("Target level"), {
      target: { value: "18" },
    });
    expect(targetStat("health")).toBeGreaterThan(0);
  });

  it("take overrides", { tags: ["TGT-003"] }, () => {
    const store = setup();
    toChampion("Garen");
    fireEvent.change(screen.getByLabelText("Armor override"), {
      target: { value: "300" },
    });
    expect(targetStat("armor")).toBe(300);
    const target = store.getState().target;
    expect(target.kind === "champion" ? target.overrides : {}).toEqual({
      armor: 300,
    });
    fireEvent.change(screen.getByLabelText("Armor override"), {
      target: { value: "" },
    });
    expect(targetStat("armor")).not.toBe(300);
  });

  it("take runes", { tags: ["TGT-012"] }, () => {
    setup();
    toChampion("Garen");
    const health = targetStat("health");
    fireEvent.click(screen.getByLabelText("Target runes"));
    // defense shard: flat health
    fireEvent.change(screen.getByLabelText("Target Shard 3"), {
      target: { value: "5011" },
    });
    expect(targetStat("health")).toBe(
      health + (patch.runes["5011"]?.values.StatGain ?? NaN),
    );
  });
});

describe("presets", () => {
  it(
    "Squishy, Bruiser and Tank ship with the app",
    { tags: ["TGT-004"] },
    () => {
      const store = setup();
      const names = within(screen.getByLabelText("Target preset"))
        .getAllByRole("option")
        .map((o) => o.textContent);
      expect(names).toEqual(["Choose…", "Squishy", "Bruiser", "Tank"]);
      fireEvent.change(screen.getByLabelText("Target preset"), {
        target: { value: "Tank" },
      });
      expect(store.getState().target).toEqual(shippedPresets[2]?.target);
      // every preset uses champions and items in the patch data
      for (const { target } of shippedPresets) {
        if (target.kind !== "champion") continue;
        expect(patch.targets[target.champion]).toBeDefined();
        for (const id of target.items) expect(patch.items[id]).toBeDefined();
      }
    },
  );

  // TGT-005's "survives a reload" half lands with persistence (SAVE-001).
  it("users can save the current target under a name", () => {
    const store = setup();
    toChampion("Garen");
    fireEvent.change(screen.getByLabelText("Preset name"), {
      target: { value: "My Garen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preset" }));
    fireEvent.change(screen.getByLabelText("Target kind"), {
      target: { value: "dummy" },
    });
    fireEvent.change(screen.getByLabelText("Target preset"), {
      target: { value: "My Garen" },
    });
    const target = store.getState().target;
    expect(target.kind === "champion" ? target.champion : "").toBe("Garen");
  });
});
