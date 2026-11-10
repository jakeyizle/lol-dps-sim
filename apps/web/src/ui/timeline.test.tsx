import { abilityRanks } from "@lol/engine";
import {
  act,
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
import {
  newBuild,
  ranksOf,
  timelineSteps,
  totalGold,
  withItem,
  withTimelineLevel,
  type Build,
} from "../model/build";
import { createAppStore } from "../model/store";
import { inlineRunner } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();
const IE = "3031";
const LDR = "3036";
const jinx = patch.champions.Jinx;
if (!jinx) throw new Error("no Jinx");

const withItems = (build: Build, ids: string[]) =>
  ids.reduce((b, id) => {
    const r = withItem(b, id, patch.items);
    return r.ok ? r.build : b;
  }, build);

describe("timeline steps", () => {
  const build = withItems(newBuild("b", "Jinx"), [IE, LDR]);

  it(
    "use the first 1, 2, … k items and their gold",
    { tags: ["CMP-002"] },
    () => {
      const steps = timelineSteps(build);
      expect(steps.map((s) => s.items)).toEqual([[IE], [IE, LDR]]);
      expect(totalGold(steps[1] ?? build, patch.items)).toBe(
        totalGold(build, patch.items),
      );
    },
  );

  it(
    "each use their own level, by default the build's",
    { tags: ["CMP-003"] },
    () => {
      expect(timelineSteps(build).map((s) => s.level)).toEqual([18, 18]);
      const set = withTimelineLevel(build, 0, 11);
      expect(timelineSteps(set).map((s) => s.level)).toEqual([11, 18]);
    },
  );

  it(
    "at a lower level use the skill order's ranks, not the build's edits",
    { tags: ["CMP-010"] },
    () => {
      const edited = withTimelineLevel(
        { ...build, ranks: { Q: 5, W: 5, E: 5, R: 3 } },
        0,
        9,
      );
      const [low, full] = timelineSteps(edited);
      expect(low && ranksOf(low, jinx)).toEqual(abilityRanks(jinx, 9));
      expect(full && ranksOf(full, jinx)).toEqual({ Q: 5, W: 5, E: 5, R: 3 });
    },
  );
});

it("the timeline shows each step's metric, gold and level", () => {
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
  expect(screen.queryByRole("region", { name: "Item timeline" })).toBeNull();
  const [first] = store.getState().builds;
  if (!first) throw new Error("no build");
  act(() => {
    store.getState().updateBuild(first.id, (b) => withItems(b, [IE, LDR]));
  });
  const table = screen.getByRole("table", { name: "Timeline table" });
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent),
  ).toEqual(["", "1 item", "2 items"]);
  expect(
    within(table)
      .getAllByText(/gold$/)
      .map((g) => g.textContent),
  ).toEqual([
    `${(patch.items[IE]?.cost ?? 0).toLocaleString("en-US")} gold`,
    `${totalGold(store.getState().builds[0] ?? first, patch.items).toLocaleString("en-US")} gold`,
  ]);
  fireEvent.change(screen.getByLabelText("Jinx step 1 level"), {
    target: { value: "9" },
  });
  expect(store.getState().builds[0]?.timelineLevels).toEqual([9, 18]);
  return waitFor(() => {
    const metrics = [...table.querySelectorAll("[data-step-metric]")].map(
      (m) => m.textContent,
    );
    expect(metrics.every((m) => /^\d+\.\d+s$/.test(m))).toBe(true);
  });
});
