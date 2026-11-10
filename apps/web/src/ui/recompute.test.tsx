import type { Analysis } from "@lol/engine";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../App";
import { loadLatest } from "../data";
import { createAppStore } from "../model/store";
import { runJob, type Job, type Runner } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();

/** A runner whose jobs finish only when the test says so. */
function manualRunner() {
  const jobs: { job: Job; finish: () => void }[] = [];
  const runner: Runner = (job) =>
    new Promise<Analysis>((resolve) => {
      jobs.push({
        job,
        finish: () => {
          resolve(runJob(job, patch));
        },
      });
    });
  return { runner, jobs };
}

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
const ttk = () => screen.queryByTestId("ttk")?.textContent;

describe("recompute", { tags: ["CMP-006"] }, () => {
  it("follows edits, and never shows old inputs' results as current", async () => {
    const { runner, jobs } = manualRunner();
    const store = createAppStore();
    render(<App store={store} patch={patch} runner={runner} debounceMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add build" }));
    await flush();
    expect(screen.getByRole("status").textContent).toBe("Computing…");

    // first job: 3000 health
    await act(async () => {
      jobs[0]?.finish();
      await Promise.resolve();
    });
    const first = ttk();
    expect(first).toMatch(/^TTK /);

    // edit while nothing is running: the old result stays but is marked stale
    fireEvent.change(screen.getByLabelText("Health"), {
      target: { value: "30000" },
    });
    await flush();
    expect(screen.getByText("Updating…")).toBeDefined();
    expect(
      screen.getByRole("region", { name: "Results" }).getAttribute("aria-busy"),
    ).toBe("true");

    // a newer edit supersedes the pending job; finishing the old one changes nothing
    fireEvent.change(screen.getByLabelText("Health"), {
      target: { value: "1000" },
    });
    await flush();
    expect(jobs).toHaveLength(3);
    await act(async () => {
      jobs[1]?.finish();
      await Promise.resolve();
    });
    expect(screen.getByText("Updating…")).toBeDefined();
    expect(ttk()).toBe(first);

    await act(async () => {
      jobs[2]?.finish();
      await Promise.resolve();
    });
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(ttk()).not.toBe(first);
    const target = jobs[2]?.job.target;
    expect(target?.kind === "dummy" ? target.health : undefined).toBe(1000);
  });
});

describe("while computing", { tags: ["CMP-011"] }, () => {
  it("applies edits immediately", async () => {
    const never: Runner = () => new Promise<Analysis>(() => undefined);
    const store = createAppStore();
    render(<App store={store} patch={patch} runner={never} debounceMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Add build" }));
    await flush();
    expect(screen.getByRole("status").textContent).toBe("Computing…");

    fireEvent.change(screen.getByLabelText("Build name"), {
      target: { value: "Crit Jinx" },
    });
    expect(store.getState().builds[0]?.name).toBe("Crit Jinx");
    expect(screen.getByLabelText<HTMLInputElement>("Build name").value).toBe(
      "Crit Jinx",
    );
    fireEvent.change(screen.getByLabelText("Add item"), {
      target: { value: patch.items["3031"]?.name },
    });
    expect(
      document.querySelector('[data-stat="Crit chance"]')?.textContent,
    ).toBe("25.0%");
  });
});
