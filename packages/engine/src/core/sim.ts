import type { AttackSlot, ChampionData } from "@lol/data";

import {
  absorb,
  resolveDamage,
  type CritMode,
  type Defender,
  type ResolvedDamage,
  type Shield,
} from "./damage";
import { EventQueue } from "./queue";
import type { StatBlock } from "./stats";

export const DEFAULT_MAX_DURATION = 20;

/** SIM-002: B + K × (W / AS − B), where B = W / base attack speed. */
export function windupTime(
  slot: AttackSlot,
  baseAttackSpeed: number,
  attackSpeed: number,
) {
  const base = slot.windupPercent / baseAttackSpeed;
  return base + slot.windupModifier * (slot.windupPercent / attackSpeed - base);
}

export interface SimAttacker {
  champion: ChampionData;
  stats: StatBlock;
  /** Attack slot for basic attacks (default `basic`); kits choose others, e.g. Jinx's rockets. */
  attackSlot?: string;
}

export interface SimTarget {
  maxHealth: number;
  defender: Defender;
  shields?: readonly Shield[];
  /** Dies when left below this fraction of max health by the attacker's damage (SIM-023). */
  executeBelow?: number;
}

export interface SimOptions {
  /** Seconds; default 20 (SIM-008). */
  maxDuration?: number;
}

export interface TraceEntry {
  time: number;
  damage: ResolvedDamage;
  absorbed: number;
  toHealth: number;
  healthAfter: number;
}

export interface SimResult {
  killed: boolean;
  /** Time of the killing blow, or null when not killed (METRIC-001, METRIC-002). */
  ttk: number | null;
  executed: boolean;
  remainingHealth: number;
  trace: TraceEntry[];
}

type SimEvent = { kind: "attackStart" } | { kind: "attackLand"; slot: string };

const EXPECTED: CritMode = { kind: "expected" };

/**
 * Discrete-event fight: one attacker auto-attacking one target that never fights back.
 * Events at the same time run in the order they were scheduled.
 * Expected-value crit mode only for now (SIM-011).
 */
export function simulate(
  attacker: SimAttacker,
  target: SimTarget,
  options: SimOptions = {},
): SimResult {
  const maxDuration = options.maxDuration ?? DEFAULT_MAX_DURATION;
  const { champion, stats } = attacker;
  const slotName = attacker.attackSlot ?? "basic";
  const slot = champion.attack.slots[slotName];
  if (!slot) throw new Error(`${champion.id} has no attack slot ${slotName}`);

  let health = target.maxHealth;
  let shields = target.shields ?? [];
  const trace: TraceEntry[] = [];
  const queue = new EventQueue<SimEvent>();
  queue.push(0, { kind: "attackStart" });

  const end = (killed: boolean, time: number | null, executed = false) => ({
    killed,
    ttk: time,
    executed,
    remainingHealth: Math.max(0, health),
    trace,
  });

  for (let next = queue.pop(); next; next = queue.pop()) {
    const { time, event } = next;
    if (time > maxDuration) break;

    if (event.kind === "attackStart") {
      const windup = windupTime(
        slot,
        champion.attack.baseAttackSpeed,
        stats.attackSpeed,
      );
      queue.push(time + windup, { kind: "attackLand", slot: slotName });
      queue.push(time + 1 / stats.attackSpeed, { kind: "attackStart" });
      continue;
    }

    const damage = resolveDamage({
      instance: {
        type: "physical",
        amount: stats.attackDamage.total,
        source: "attack",
        sourceId: event.slot,
        autoAttack: true,
        critable: true,
      },
      attacker: stats,
      defender: target.defender,
      critMode: EXPECTED,
    });
    const shielded = absorb(
      shields,
      damage.postMitigation,
      damage.instance.type,
    );
    shields = shielded.shields;
    health -= shielded.toHealth;
    trace.push({
      time,
      damage,
      absorbed: shielded.absorbed,
      toHealth: shielded.toHealth,
      healthAfter: health,
    });

    if (health <= 0) return end(true, time);
    if (
      target.executeBelow !== undefined &&
      health < target.executeBelow * target.maxHealth
    )
      return end(true, time, true);
  }
  return end(false, null);
}
