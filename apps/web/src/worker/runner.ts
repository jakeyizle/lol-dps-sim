import type { PatchData } from "@lol/data";
import { analyze, type Analysis } from "@lol/engine";
import { wrap } from "comlink";

import type { Build } from "../model/build";
import {
  toSimulation,
  type DummyTarget,
  type Settings,
} from "../model/simulation";

/** Plain data only, so a worker can rebuild effects itself. */
export interface Job {
  build: Build;
  target: DummyTarget;
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

/** Runs jobs in a Web Worker via Comlink, off the main thread (CMP-011). */
export function workerRunner(): Runner {
  const worker = wrap<SimWorker>(
    new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" }),
  );
  return (job) => worker.run(job);
}

export function defaultRunner(patch: PatchData): Runner {
  return typeof Worker === "undefined" ? inlineRunner(patch) : workerRunner();
}
