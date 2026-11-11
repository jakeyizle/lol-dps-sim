import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { loadLatest } from "../data";
import { newBuild, type Build } from "../model/build";
import { createAppStore } from "../model/store";
import { defaultDummy } from "../model/target";
import { runJob, type Job, type Runner } from "../worker/runner";
import { Providers } from "./Providers";
import {
  useAnalysis,
  useEffectiveHealth,
  useJobs,
  type JobEntry,
} from "./useAnalysis";

afterEach(cleanup);

const patch = loadLatest();
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

/** Hooks under Providers with a runner that records every job it is sent. */
function setup(debounceMs = 0) {
  const store = createAppStore();
  const sent: Job[] = [];
  const runner: Runner = (job) => {
    sent.push(job);
    return Promise.resolve(runJob(job, patch));
  };
  const wrapper = (props: { children: ReactNode }) => (
    <Providers store={store} patch={patch} runner={{ runner, debounceMs }}>
      {props.children}
    </Providers>
  );
  return { store, sent, wrapper };
}

const a = newBuild("a", "Jinx", "A");
const b = newBuild("b", "Caitlyn", "B");
const entry = (build: Build): JobEntry => ({
  key: build.id,
  build,
  target: defaultDummy,
});

describe("analysis hooks", { tags: ["CMP-006"] }, () => {
  it("need the app's providers", () => {
    expect(() => renderHook(() => useJobs([]))).toThrow(
      "useJobs outside Providers",
    );
  });

  it("send only entries whose inputs changed", async () => {
    const { sent, wrapper } = setup();
    const { result, rerender } = renderHook(
      (props: { entries: JobEntry[] }) => useJobs(props.entries),
      { wrapper, initialProps: { entries: [entry(a), entry(b)] } },
    );
    await wait(0);
    expect(sent.map((j) => j.build.id)).toEqual(["a", "b"]);

    const b2 = { ...b, level: 6 };
    rerender({ entries: [entry(a), entry(b2)] });
    await wait(0);
    expect(sent.map((j) => j.build)).toEqual([a, b, b2]);
    expect(result.current.map((r) => r.stale)).toEqual([false, false]);

    // the same inputs under another key are a job of their own
    rerender({ entries: [entry(a), { ...entry(a), key: "a2" }] });
    await wait(0);
    expect(result.current.map((r) => r.key)).toEqual(["a", "a2"]);
    expect(sent).toHaveLength(4);

    // dropping the last entry drops its result
    rerender({ entries: [entry(a)] });
    expect(result.current.map((r) => r.key)).toEqual(["a"]);
  });

  it("send nothing until edits settle", async () => {
    const { store, sent, wrapper } = setup(40);
    renderHook(() => useAnalysis(a), { wrapper });
    await wait(10);
    act(() => {
      store.getState().setSettings({ gameTime: 5 });
    });
    await wait(10);
    act(() => {
      store.getState().setSettings({ gameTime: 6 });
    });
    await wait(80);
    expect(sent.map((j) => j.settings.gameTime)).toEqual([6]);
  });

  it("follow the build they are given", async () => {
    const { sent, wrapper } = setup();
    const { result, rerender } = renderHook(
      (props: { build: Build }) => useAnalysis(props.build),
      { wrapper, initialProps: { build: a } },
    );
    await wait(0);
    expect(result.current.stale).toBe(false);
    const a2 = { ...a, level: 6 };
    rerender({ build: a2 });
    expect(result.current.stale).toBe(true);
    await wait(0);
    expect(sent.map((j) => j.build)).toEqual([a, a2]);
    expect(result.current.stale).toBe(false);
  });
});

describe("effective health", { tags: ["CMP-009"] }, () => {
  it("follows the target", () => {
    const { store, wrapper } = setup();
    const { result } = renderHook(() => useEffectiveHealth(), { wrapper });
    expect(result.current).toBe(defaultDummy.health);
    act(() => {
      store.getState().setTarget({ ...defaultDummy, health: 5000 });
    });
    expect(result.current).toBe(5000);
  });
});
