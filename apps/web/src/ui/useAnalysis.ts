import type { Analysis } from "@lol/engine";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { Build } from "../model/build";
import type { Job, Runner } from "../worker/runner";
import { useApp } from "./context";

export const RunnerContext = createContext<{
  runner: Runner;
  debounceMs: number;
} | null>(null);

/**
 * CMP-006: recompute after edits settle (debounced); a result only counts as current
 * when it came from the exact inputs now shown, so older ones are marked stale.
 */
export function useAnalysis(build: Build): {
  result: Analysis | undefined;
  stale: boolean;
} {
  const ctx = useContext(RunnerContext);
  if (!ctx) throw new Error("useAnalysis outside Providers");
  const { runner, debounceMs } = ctx;
  const target = useApp((s) => s.target);
  const settings = useApp((s) => s.settings);
  const job: Job = useMemo(
    () => ({ build, target, settings }),
    [build, target, settings],
  );
  const [done, setDone] = useState<{ job: Job; result: Analysis }>();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void runner(job).then((result) => {
        if (!cancelled) setDone({ job, result });
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [job, runner, debounceMs]);

  return { result: done?.result, stale: done?.job !== job };
}
