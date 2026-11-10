import { hasDefensiveKit, type Analysis } from "@lol/engine";
import { useMemo, useState } from "react";

import type { Build } from "../model/build";
import { shippedPresets, targetName, type Target } from "../model/target";
import { useApp, usePatch } from "./context";
import { useJobs } from "./useAnalysis";

const n = (x: number) => Math.round(x).toLocaleString("en-US");

type Metric = { kind: "ttk" } | { kind: "dps"; seconds: number };

function metricValue(metric: Metric, a: Analysis): number | undefined {
  if (metric.kind === "ttk") return a.killed ? (a.ttk ?? undefined) : undefined;
  return a.dps.find((w) => w.seconds === metric.seconds)?.dps;
}

/**
 * Sequential ramp (one hue, dataviz reference blue): darker = closer to the column's best.
 * Each step names its text colour so the printed value keeps its contrast.
 */
const FLOOR = { bg: "#cde2fb", fg: "#0b0b0b" };
const RAMP = [
  { min: 0.95, bg: "#1c5cab", fg: "#ffffff" },
  { min: 0.85, bg: "#2a78d6", fg: "#ffffff" },
  { min: 0.75, bg: "#5598e7", fg: "#0b0b0b" },
  { min: 0.6, bg: "#86b6ef", fg: "#0b0b0b" },
] as const;
const shade = (share: number) => RAMP.find((s) => share >= s.min) ?? FLOOR;

/** CMP-004: the chosen metric for every compared build vs every matrix target. */
export function Matrix(props: { builds: readonly Build[] }) {
  const patch = usePatch();
  const targets = useApp((s) => s.matrixTargets);
  const current = useApp((s) => s.target);
  const add = useApp((s) => s.addMatrixTarget);
  const remove = useApp((s) => s.removeMatrixTarget);
  const windows = useApp((s) => s.settings.dpsWindows);
  const [metric, setMetric] = useState<Metric>({ kind: "ttk" });

  const entries = useMemo(
    () =>
      props.builds.flatMap((build) =>
        targets.map((t) => ({
          key: `${build.id}|${t.id}`,
          build,
          target: t.target,
        })),
      ),
    [props.builds, targets],
  );
  const results = useJobs(entries);
  const byKey = new Map(results.map((r) => [r.key, r]));
  const stale = results.some((r) => r.stale);
  const label = (t: Target) =>
    `${targetName(t, patch)}${t.kind === "champion" && !hasDefensiveKit(t.champion) ? " (stats only)" : ""}`;

  const value = (buildId: string, targetId: string) => {
    const result = byKey.get(`${buildId}|${targetId}`)?.result;
    return result ? { ready: true, v: metricValue(metric, result) } : undefined;
  };
  const best = (targetId: string) => {
    const vs = props.builds.flatMap((b) => {
      const v = value(b.id, targetId)?.v;
      return v === undefined ? [] : [v];
    });
    if (vs.length === 0) return undefined;
    return metric.kind === "ttk" ? Math.min(...vs) : Math.max(...vs);
  };

  return (
    <section
      aria-label="Build × target matrix"
      aria-busy={stale}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="text-xl font-semibold">Build × target</h2>
        <label className="flex items-center gap-2 text-sm">
          Metric
          <select
            aria-label="Matrix metric"
            className="rounded border px-1 py-0.5"
            value={metric.kind === "ttk" ? "ttk" : String(metric.seconds)}
            onChange={(e) => {
              setMetric(
                e.target.value === "ttk"
                  ? { kind: "ttk" }
                  : { kind: "dps", seconds: Number(e.target.value) },
              );
            }}
          >
            <option value="ttk">TTK</option>
            {windows.map((s) => (
              <option key={s} value={String(s)}>
                DPS {s}s
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded border px-2 text-sm"
          onClick={() => {
            add(label(current), current);
          }}
        >
          Add current target
        </button>
        <button
          type="button"
          className="rounded border px-2 text-sm"
          onClick={() => {
            for (const p of shippedPresets) add(p.name, p.target);
          }}
        >
          Add presets
        </button>
        {stale && targets.length > 0 && (
          <p role="status" className="text-sm text-neutral-600">
            Updating…
          </p>
        )}
      </div>
      {targets.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Add targets to compare every build against each of them.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="Matrix" className="text-sm">
            <thead>
              <tr>
                <th />
                {targets.map((t) => (
                  <th
                    key={t.id}
                    scope="col"
                    className="px-2 text-left font-normal"
                  >
                    <div className="flex items-center gap-1">
                      <span>
                        {t.name}
                        {t.name !== label(t.target) && (
                          <span className="block text-xs text-neutral-600">
                            {label(t.target)}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="text-neutral-500"
                        aria-label={`Remove ${t.name} from the matrix`}
                        onClick={() => {
                          remove(t.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.builds.map((b) => (
                <tr key={b.id}>
                  <th scope="row" className="pr-3 text-left font-normal">
                    {b.name}
                  </th>
                  {targets.map((t) => {
                    const cell = value(b.id, t.id);
                    const top = best(t.id);
                    let text = "…";
                    let style: React.CSSProperties | undefined;
                    if (cell?.v === undefined && cell?.ready)
                      text = "Not killed";
                    else if (cell?.v !== undefined) {
                      text =
                        metric.kind === "ttk"
                          ? `${cell.v.toFixed(2)}s`
                          : n(cell.v);
                      if (top !== undefined) {
                        const share =
                          metric.kind === "ttk" ? top / cell.v : cell.v / top;
                        const s = shade(share);
                        style = { background: s.bg, color: s.fg };
                      }
                    }
                    return (
                      <td
                        key={t.id}
                        className="border border-white px-3 py-1 text-right tabular-nums"
                        style={style}
                        title={`${b.name} vs ${t.name}: ${text}`}
                        data-best={
                          (cell?.v !== undefined && cell.v === top) || undefined
                        }
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-neutral-600">
            Darker is closer to the best build for that target.
          </p>
        </div>
      )}
    </section>
  );
}
