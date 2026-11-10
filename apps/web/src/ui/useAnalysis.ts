import { effectiveHealth, type Analysis } from "@lol/engine";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Build } from "../model/build";
import { toSimTarget, type Target } from "../model/target";
import type { Job, Runner } from "../worker/runner";
import { useApp, usePatch } from "./context";

export const RunnerContext = createContext<{
  runner: Runner;
  debounceMs: number;
} | null>(null);

export interface BuildAnalysis {
  build: Build;
  result: Analysis | undefined;
  /** The result came from other inputs than those now shown. */
  stale: boolean;
}

/** One build against one target, keyed for the results map. */
export interface JobEntry {
  key: string;
  build: Build;
  target: Target;
}

export interface JobAnalysis extends BuildAnalysis {
  key: string;
}

/**
 * CMP-006: recompute after edits settle (debounced); a result only counts as current
 * when it came from the exact inputs now shown, so older ones are marked stale.
 * Entries whose build and target didn't change keep their job and aren't recomputed.
 */
export function useJobs(entries: readonly JobEntry[]): JobAnalysis[] {
  const ctx = useContext(RunnerContext);
  if (!ctx) throw new Error("useJobs outside Providers");
  const { runner, debounceMs } = ctx;
  const settings = useApp((s) => s.settings);
  // Keep each unchanged entry's job object (React's "previous render" pattern).
  const [prev, setPrev] = useState<readonly (Job & { key: string })[]>([]);
  const next = entries.map(
    ({ key, build, target }) =>
      prev.find(
        (j) =>
          j.key === key &&
          j.build === build &&
          j.target === target &&
          j.settings === settings,
      ) ?? { key, build, target, settings },
  );
  const changed =
    next.length !== prev.length || next.some((j, i) => j !== prev[i]);
  if (changed) setPrev(next);
  const jobs = changed ? next : prev;
  const [done, setDone] = useState<
    ReadonlyMap<string, { job: Job; result: Analysis }>
  >(new Map());
  // Jobs already sent; only an entry's current job may set its result.
  const sent = useRef(new WeakSet<Job>());
  const current = useRef(new Set<Job>());

  useEffect(() => {
    current.current = new Set(jobs);
    const timer = setTimeout(() => {
      for (const job of jobs) {
        if (sent.current.has(job)) continue;
        sent.current.add(job);
        const { key, ...plain } = job;
        void runner(plain).then((result) => {
          if (!current.current.has(job)) return;
          setDone((prev) => new Map(prev).set(key, { job, result }));
        });
      }
    }, debounceMs);
    return () => {
      clearTimeout(timer);
    };
  }, [jobs, runner, debounceMs]);

  return jobs.map((job) => {
    const entry = done.get(job.key);
    return {
      key: job.key,
      build: job.build,
      result: entry?.result,
      stale: entry?.job !== job,
    };
  });
}

/** Every build against the current target (see `useJobs`). */
export function useAnalyses(builds: readonly Build[]): BuildAnalysis[] {
  const target = useApp((s) => s.target);
  return useJobs(builds.map((build) => ({ key: build.id, build, target })));
}

/** One build's analysis (see `useAnalyses`). */
export function useAnalysis(build: Build): {
  result: Analysis | undefined;
  stale: boolean;
} {
  const builds = useMemo(() => [build], [build]);
  const [only] = useAnalyses(builds);
  return { result: only?.result, stale: only?.stale ?? true };
}

/** The target's effective health, for the chart's reference line (CMP-009). */
export function useEffectiveHealth() {
  const target = useApp((s) => s.target);
  const gameTime = useApp((s) => s.settings.gameTime);
  const patch = usePatch();
  return useMemo(
    () => effectiveHealth(toSimTarget(target, patch, gameTime)),
    [target, patch, gameTime],
  );
}
