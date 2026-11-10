import type { DamageType } from "./core/damage";
import {
  simulate,
  type SimAttacker,
  type SimOptions,
  type SimResult,
  type SimTarget,
  type TraceEntry,
} from "./core/sim";
import type { StatBlock } from "./core/stats";

export const DEFAULT_DPS_WINDOWS: readonly number[] = [3, 6, 10];

export interface DpsWindow {
  seconds: number;
  dps: number;
}

export interface CurvePoint {
  time: number;
  cumulative: number;
}

export interface Breakdown {
  total: number;
  byType: Record<DamageType, number>;
  /** By what dealt it (`sourceId`, e.g. `basic`, `JinxW`, `KrakenSlayer`). */
  bySource: Record<string, number>;
}

/** METRIC-003: post-mitigation damage in [0, N] ÷ N, for each window N. */
export function dpsWindows(
  trace: readonly TraceEntry[],
  windows: readonly number[] = DEFAULT_DPS_WINDOWS,
): DpsWindow[] {
  return windows.map((seconds) => ({
    seconds,
    dps:
      trace
        .filter((t) => t.time <= seconds)
        .reduce((sum, t) => sum + t.damage.postMitigation, 0) / seconds,
  }));
}

/** METRIC-004: cumulative post-mitigation damage at each damage instance. */
export function damageCurve(trace: readonly TraceEntry[]): CurvePoint[] {
  let cumulative = 0;
  return trace.map((t) => {
    cumulative += t.damage.postMitigation;
    return { time: t.time, cumulative };
  });
}

/** METRIC-005: totals by damage type and by source; each split sums to the total. */
export function breakdown(trace: readonly TraceEntry[]): Breakdown {
  const result: Breakdown = {
    total: 0,
    byType: { physical: 0, magic: 0, true: 0 },
    bySource: {},
  };
  for (const t of trace) {
    const amount = t.damage.postMitigation;
    const { type, sourceId } = t.damage.instance;
    result.total += amount;
    result.byType[type] += amount;
    result.bySource[sourceId] = (result.bySource[sourceId] ?? 0) + amount;
  }
  return result;
}

export interface Analysis {
  /** METRIC-001 / METRIC-002: null when not killed. */
  ttk: number | null;
  killed: boolean;
  executed: boolean;
  remainingHealth: number;
  dps: DpsWindow[];
  curve: CurvePoint[];
  breakdown: Breakdown;
  /** METRIC-007. */
  stats: StatBlock;
  /** The normal run (event log, METRIC-006). */
  fight: SimResult;
}

/**
 * Runs the fight twice: the normal run for TTK, curve, breakdown and the event log, and
 * the DPS run (PLAN §6) for the DPS windows.
 */
export function analyze(
  attacker: SimAttacker,
  target: SimTarget,
  options: SimOptions & { dpsWindows?: readonly number[] } = {},
): Analysis {
  const windows = options.dpsWindows ?? DEFAULT_DPS_WINDOWS;
  const fight = simulate(attacker, target, options);
  const dpsRun = simulate(attacker, target, {
    ...options,
    dpsRun: true,
    maxDuration: Math.max(...windows),
  });
  return {
    ttk: fight.ttk,
    killed: fight.killed,
    executed: fight.executed,
    remainingHealth: fight.remainingHealth,
    dps: dpsWindows(dpsRun.trace, windows),
    curve: damageCurve(fight.trace),
    breakdown: breakdown(fight.trace),
    stats: fight.stats,
    fight,
  };
}

/**
 * CMP-009: damage needed to kill, before shield decay: health, shields (static and
 * low-health) and revive health.
 */
export function effectiveHealth(target: SimTarget): number {
  return (
    target.maxHealth +
    (target.shields ?? []).reduce((sum, s) => sum + s.amount, 0) +
    (target.lowHealthShields ?? []).reduce((sum, s) => sum + s.amount, 0) +
    (target.revive?.health ?? 0)
  );
}
