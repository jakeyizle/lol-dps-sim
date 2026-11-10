import type { Analysis } from "@lol/engine";
import type { ReactNode } from "react";

import type { Build } from "../model/build";
import { useApp } from "./context";
import { DamageChart } from "./DamageChart";
import {
  useAnalyses,
  useEffectiveHealth,
  type BuildAnalysis,
} from "./useAnalysis";

const n = (x: number) => Math.round(x).toLocaleString("en-US");

interface Row {
  label: string;
  /** The metric per build, or undefined when it doesn't apply (e.g. not killed). */
  value: (a: Analysis) => number | undefined;
  format: (a: Analysis) => string;
  best?: "min" | "max";
}

/** CMP-001, CMP-009: every compared build against the target. */
export function Compare(props: { builds: readonly Build[] }) {
  const analyses = useAnalyses(props.builds);
  const maxDuration = useApp((s) => s.settings.maxDuration);
  const health = useEffectiveHealth();
  const ready = analyses.filter(
    (a): a is BuildAnalysis & { result: Analysis } => a.result !== undefined,
  );
  const stale = analyses.some((a) => a.stale);
  const windows = ready[0]?.result.dps.map((w) => w.seconds) ?? [];
  const sources = [
    ...new Set(ready.flatMap((a) => Object.keys(a.result.breakdown.bySource))),
  ].sort();

  const rows: Row[] = [
    {
      label: "TTK",
      value: (a) => (a.killed ? (a.ttk ?? undefined) : undefined),
      format: (a) => (a.killed ? `${a.ttk?.toFixed(2) ?? "?"}s` : "Not killed"),
      best: "min",
    },
    ...windows.map((seconds, i): Row => ({
      label: `DPS ${String(seconds)}s`,
      value: (a) => a.dps[i]?.dps,
      format: (a) => n(a.dps[i]?.dps ?? 0),
      best: "max",
    })),
    {
      label: "Total damage",
      value: (a) => a.breakdown.total,
      format: (a) => n(a.breakdown.total),
      best: "max",
    },
    ...sources.map((source): Row => ({
      label: source,
      value: (a) => a.breakdown.bySource[source] ?? 0,
      format: (a) => n(a.breakdown.bySource[source] ?? 0),
    })),
  ];
  const duration = Math.max(
    1,
    ...ready.map((a) => a.result.ttk ?? maxDuration),
  );

  return (
    <section
      aria-label="Comparison"
      aria-busy={stale}
      className={`space-y-4 transition-opacity ${stale ? "opacity-50" : ""}`}
    >
      <h2 className="text-xl font-semibold">Comparison</h2>
      {stale && (
        <p role="status" className="text-sm text-neutral-600">
          Updating…
        </p>
      )}
      <div className="overflow-x-auto">
        <table aria-label="Comparison table" className="text-sm">
          <thead>
            <tr>
              <th />
              {analyses.map((a) => (
                <th key={a.build.id} scope="col" className="px-3 text-left">
                  {a.build.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MetricRow key={row.label} row={row} analyses={analyses} />
            ))}
          </tbody>
        </table>
      </div>
      <DamageChart
        series={ready.map((a) => ({
          id: a.build.id,
          label: a.build.name,
          curve: a.result.curve,
        }))}
        duration={duration}
        reference={{ value: health, label: `Effective health ${n(health)}` }}
      />
    </section>
  );
}

function MetricRow(props: { row: Row; analyses: BuildAnalysis[] }) {
  const { row, analyses } = props;
  const values = analyses.map((a) =>
    a.result ? row.value(a.result) : undefined,
  );
  const defined = values.filter((v): v is number => v !== undefined);
  const best =
    row.best && defined.length > 1
      ? row.best === "min"
        ? Math.min(...defined)
        : Math.max(...defined)
      : undefined;
  return (
    <tr className="border-t border-neutral-200">
      <th scope="row" className="pr-4 text-left font-normal text-neutral-600">
        {row.label}
      </th>
      {analyses.map((a, i) => {
        let cell: ReactNode = "…";
        const isBest = best !== undefined && values[i] === best;
        if (a.result) cell = row.format(a.result);
        return (
          <td
            key={a.build.id}
            className={`px-3 tabular-nums ${isBest ? "font-semibold" : ""}`}
            data-best={isBest || undefined}
          >
            {cell}
            {isBest && (
              <span className="ml-1 rounded bg-neutral-100 px-1 text-xs font-normal text-neutral-700">
                best
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
