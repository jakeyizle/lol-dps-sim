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
import { createAppStore } from "../model/store";
import { inlineRunner } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();

async function setup() {
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
  await screen.findByRole("table", { name: "Event log" });
  return store;
}
const log = () => within(screen.getByRole("table", { name: "Event log" }));

describe("event log", () => {
  it(
    "shows time, source, pre/post damage, crit flag and active buffs per instance",
    { tags: ["METRIC-006"] },
    async () => {
      await setup();
      const headers = log()
        .getAllByRole("columnheader")
        .map((h) => h.textContent);
      expect(headers).toEqual([
        "Time",
        "Source",
        "Pre",
        "Post",
        "Crit",
        "Buffs",
      ]);
      const rows = log().getAllByRole("row").slice(1);
      expect(rows.length).toBeGreaterThan(1);
      const [firstRow] = rows;
      if (!firstRow) throw new Error("empty event log");
      const first = within(firstRow)
        .getAllByRole("cell")
        .map((c) => c.textContent);
      expect(first[1]).toBe("basic");
      // Jinx's minigun stacks show as an active buff on later attacks
      expect(rows.some((r) => r.textContent.includes("JinxRevdUp"))).toBe(true);
    },
  );

  it(
    "marks attacks 'averaged' in expected-value mode",
    { tags: ["METRIC-010"] },
    async () => {
      await setup();
      const crit = log()
        .getAllByRole("row")
        .slice(1)
        .filter((r) => r.textContent.includes("basic"))
        .map((r) => within(r).getAllByRole("cell")[4]?.textContent);
      expect(new Set(crit)).toEqual(new Set(["averaged"]));
    },
  );
});

describe("target dummy", { tags: ["TGT-002"] }, () => {
  it("uses the entered stats", async () => {
    const store = await setup();
    fireEvent.change(screen.getByLabelText("Health"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText("Armor"), {
      target: { value: "0" },
    });
    expect(store.getState().target).toMatchObject({ health: 1000, armor: 0 });
    await waitFor(() => {
      expect(screen.queryByText("Updating…")).toBeNull();
    });
    expect(screen.getByTestId("ttk").textContent).toMatch(/^TTK /);
  });
});
