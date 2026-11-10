import {
  simulate,
  type SimAttacker,
  type SimOptions,
  type SimResult,
  type SimTarget,
} from "./sim";

export interface Spread {
  mean: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface ManyResult {
  runs: number;
  /** Fraction of runs that killed the target. */
  killRate: number;
  /**
   * Time to kill; a run that didn't kill counts as Infinity, so a percentile is Infinity when
   * enough runs failed, and the mean is Infinity if any did.
   */
  ttk: Spread;
  /** Post-mitigation damage dealt (before shields). */
  damage: Spread;
}

/** Nearest-rank percentile of sorted values. */
export function percentile(sorted: readonly number[], p: number) {
  if (sorted.length === 0) throw new Error("no values");
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[rank - 1] ?? NaN;
}

export function spread(values: readonly number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
  };
}

const totalDamage = (r: SimResult) =>
  r.trace.reduce((sum, e) => sum + e.damage.postMitigation, 0);

/**
 * SIM-013: RNG mode runs `runs` times (default 200), run i seeded with seed + i.
 * Expected-value mode is deterministic, so it runs once.
 */
export function simulateMany(
  attacker: SimAttacker,
  target: SimTarget,
  options: SimOptions & { runs?: number } = {},
): ManyResult {
  const rng = options.critMode === "rng";
  const runs = rng ? (options.runs ?? 200) : 1;
  const seed = options.seed ?? 1;
  const results = Array.from({ length: runs }, (_, i) =>
    simulate(attacker, target, { ...options, seed: seed + i }),
  );
  return {
    runs,
    killRate: results.filter((r) => r.killed).length / runs,
    ttk: spread(results.map((r) => r.ttk ?? Infinity)),
    damage: spread(results.map(totalDamage)),
  };
}
