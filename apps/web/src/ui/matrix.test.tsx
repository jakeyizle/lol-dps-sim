import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { App } from "../App";
import { loadLatest } from "../data";
import { withItem } from "../model/build";
import { createAppStore } from "../model/store";
import { inlineRunner } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();

it(
  "shows the metric per build and target, shaded relative to each column's best",
  { tags: ["CMP-004"] },
  async () => {
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
        const r = withItem({ ...b, name: "With IE" }, "3031", patch.items);
        return r.ok ? r.build : b;
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Add presets" }));
    fireEvent.click(screen.getByRole("button", { name: "Add current target" }));
    const table = screen.getByRole("table", { name: "Matrix" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .slice(1)
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "SquishyLux (stats only)×",
      "BruiserGaren (stats only)×",
      "TankOrnn (stats only)×",
      "Target dummy×",
    ]);
    await waitFor(() => {
      expect(within(table).queryByText("…")).toBeNull();
    });
    // the IE build is best in every column: its cells are the darkest shade
    const rows = within(table).getAllByRole("row").slice(1);
    const ie = rows.find((r) => r.textContent.startsWith("With IE"));
    const cells = ie?.querySelectorAll("td") ?? [];
    expect(cells).toHaveLength(4);
    for (const c of cells) {
      expect(c.hasAttribute("data-best")).toBe(true);
      expect(c.style.background).toBe("rgb(28, 92, 171)");
      expect(c.textContent).toMatch(/^\d+\.\d+s$|^Not killed$/);
    }

    fireEvent.click(screen.getByLabelText("Remove Tank from the matrix"));
    expect(store.getState().matrixTargets.map((t) => t.name)).toEqual([
      "Squishy",
      "Bruiser",
      "Target dummy",
    ]);
  },
);
