import type { PatchData } from "@lol/data";
import { analyze, type Analysis } from "@lol/engine";
import { wrap } from "comlink";

import type { Build } from "../model/build";
import { toSimulation, type Settings } from "../model/simulation";
import type { Target } from "../model/target";

/** Plain data only, so a worker can rebuild effects itself. */
export interface Job {
  build: Build;
  target: Target;
  settings: Settings;
}

export type Runner = (job: Job) => Promise<Analysis>;

export function runJob(job: Job, patch: PatchData): Analysis {
  const sim = toSimulation(job.build, job.target, patch, job.settings);
  return analyze(sim.attacker, sim.target, sim.options);
}

/** Runs on the calling thread (tests, and browsers without workers). */
export const inlineRunner =
  (patch: PatchData): Runner =>
  (job) =>
    Promise.resolve(runJob(job, patch));

export interface SimWorker {
  run: (job: Job) => Analysis;
}

/**
 * Runs jobs in a pool of Web Workers via Comlink, off the main thread (CMP-011); each job
 * goes to the worker with the fewest jobs in flight.
 */
export function workerPool(size: number): Runner {
  const workers = Array.from({ length: Math.max(1, size) }, () => ({
    api: wrap<SimWorker>(
      new Worker(new URL("./sim.worker.ts", import.meta.url), {
        type: "module",
      }),
    ),
    busy: 0,
  }));
  return async (job) => {
    const worker = workers.reduce((a, b) => (b.busy < a.busy ? b : a));
    worker.busy += 1;
    try {
      return await worker.api.run(job);
    } finally {
      worker.busy -= 1;
    }
  };
}

/** Up to 4 workers, leaving a core for the page. */
export const poolSize = (cores: number | undefined) =>
  Math.max(1, Math.min(4, (cores ?? 2) - 1));

export function defaultRunner(patch: PatchData): Runner {
  return typeof Worker === "undefined"
    ? inlineRunner(patch)
    : workerPool(poolSize(navigator.hardwareConcurrency));
}
