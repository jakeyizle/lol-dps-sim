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
import { withItem } from "../model/build";
import { createAppStore } from "../model/store";
import { inlineRunner } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();
const IE = "3031";

/** Two Jinx builds; the second has Infinity Edge, so it kills faster. */
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
  const add = screen.getByRole("button", { name: "Add build" });
  fireEvent.click(add);
  fireEvent.click(add);
  const [, second] = store.getState().builds;
  if (!second) throw new Error("no second build");
  act(() => {
    store.getState().updateBuild(second.id, (b) => {
      const r = withItem({ ...b, name: "With IE" }, IE, patch.items);
      return r.ok ? r.build : b;
    });
  });
  return store;
}
const table = () => screen.getByRole("table", { name: "Comparison table" });
const row = (label: string) =>
  within(table())
    .getAllByRole("row")
    .find((r) => within(r).queryByRole("rowheader", { name: label }));

describe("comparison", () => {
  it(
    "shows every compared build's metrics in one table, best per metric marked",
    { tags: ["CMP-001"] },
    async () => {
      setup();
      await waitFor(() => {
        expect(within(table()).queryByText("…")).toBeNull();
      });
      const headers = within(table())
        .getAllByRole("columnheader")
        .map((h) => h.textContent);
      expect(headers.slice(1)).toEqual(["Jinx", "With IE"]);
      for (const label of ["TTK", "DPS 3s", "Total damage", "basic"]) {
        expect(row(label)).toBeDefined();
      }
      // the IE build is best on TTK and DPS, marked in text, not colour alone
      const best = (label: string) =>
        row(label)?.querySelector("[data-best]")?.textContent;
      expect(best("TTK")).toMatch(/best$/);
      const cells = row("TTK")?.querySelectorAll("td");
      expect(cells?.[1]?.hasAttribute("data-best")).toBe(true);
      expect(row("DPS 3s")?.querySelectorAll("td")[1]?.textContent).toMatch(
        /best$/,
      );
    },
  );

  it(
    "draws every build on one chart with the target's effective health",
    { tags: ["CMP-009"] },
    async () => {
      setup();
      const section = screen.getByRole("region", { name: "Comparison" });
      await waitFor(() => {
        expect(within(section).queryByRole("status")).toBeNull();
      });
      const legend = within(section).getByRole("list", { name: "Legend" });
      expect(
        within(legend)
          .getAllByRole("listitem")
          .map((li) => li.textContent),
      ).toEqual(["Jinx", "With IE"]);
      expect(within(section).getByTestId("reference-line").textContent).toBe(
        "Effective health 3,000",
      );
    },
  );

  it("leaves out builds that aren't compared", () => {
    const store = setup();
    expect(screen.getByRole("region", { name: "Comparison" })).toBeDefined();
    fireEvent.click(screen.getByLabelText("Compare With IE"));
    expect(store.getState().compared).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Comparison" })).toBeNull();
  });
});
