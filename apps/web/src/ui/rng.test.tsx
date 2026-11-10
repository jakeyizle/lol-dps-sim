import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { App } from "../App";
import { loadLatest } from "../data";
import { createAppStore } from "../model/store";
import { inlineRunner, poolSize } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();

it(
  "random crit mode shows TTK percentiles over its runs",
  { tags: ["SIM-013"] },
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
    fireEvent.click(screen.getByRole("button", { name: "Add build" }));
    expect(screen.queryByTestId("spread")).toBeNull();
    fireEvent.change(screen.getByLabelText("Crit mode"), {
      target: { value: "rng" },
    });
    fireEvent.change(screen.getByLabelText("RNG runs"), {
      target: { value: "20" },
    });
    expect(store.getState().settings).toMatchObject({
      critMode: "rng",
      runs: 20,
    });
    await waitFor(() => {
      expect(screen.getByTestId("spread").textContent).toMatch(
        /^Random crits, 20 runs: TTK p10 .+ · p50 .+ · p90 .+ · killed in \d+% of runs$/,
      );
    });
  },
);

it("the worker pool leaves a core for the page, up to 4 workers", () => {
  expect([undefined, 1, 2, 4, 8, 16].map(poolSize)).toEqual([1, 1, 1, 3, 4, 4]);
});
