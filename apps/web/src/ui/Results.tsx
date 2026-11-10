import type { Analysis } from "@lol/engine";

import type { Build } from "../model/build";
import { useApp } from "./context";
import { DamageChart } from "./DamageChart";
import { useAnalysis } from "./useAnalysis";

const n = (x: number) => Math.round(x).toLocaleString("en-US");

/** One build vs the dummy: TTK, DPS windows, curve, breakdown, event log. */
export function Results(props: { build: Build }) {
  const { result, stale } = useAnalysis(props.build);
  const maxDuration = useApp((s) => s.settings.maxDuration);
  if (!result)
    return (
      <p role="status" className="text-neutral-600">
        Computing…
      </p>
    );
  return (
    <section
      aria-label="Results"
      aria-busy={stale}
      className={`space-y-5 transition-opacity ${stale ? "opacity-50" : ""}`}
    >
      {stale && (
        <p role="status" className="text-sm text-neutral-600">
          Updating…
        </p>
      )}
      <ResultBody result={result} maxDuration={maxDuration} />
    </section>
  );
}

function ResultBody(props: { result: Analysis; maxDuration: number }) {
  const { result } = props;
  const duration = result.ttk ?? props.maxDuration;
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-6">
        <p className="text-2xl font-semibold" data-testid="ttk">
          {result.killed
            ? `TTK ${result.ttk?.toFixed(2) ?? "?"}s${result.executed ? " (executed)" : ""}`
            : `Not killed · ${n(result.remainingHealth)} health left`}
        </p>
        <table className="text-sm">
          <thead>
            <tr>
              {result.dps.map((w) => (
                <th
                  key={w.seconds}
                  className="px-2 text-left font-normal text-neutral-600"
                >
                  DPS {w.seconds}s
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {result.dps.map((w) => (
                <td key={w.seconds} className="px-2 tabular-nums">
                  {n(w.dps)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <DamageChart curve={result.curve} duration={Math.max(duration, 1)} />

      <div className="flex flex-wrap gap-8 text-sm">
        <table aria-label="Damage by type">
          <tbody>
            {(["physical", "magic", "true"] as const).map((t) => (
              <tr key={t}>
                <td className="pr-4 capitalize text-neutral-600">{t}</td>
                <td className="text-right tabular-nums">
                  {n(result.breakdown.byType[t])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <table aria-label="Damage by source">
          <tbody>
            {Object.entries(result.breakdown.bySource)
              .sort((a, b) => b[1] - a[1])
              .map(([source, amount]) => (
                <tr key={source}>
                  <td className="pr-4 text-neutral-600">{source}</td>
                  <td className="text-right tabular-nums">{n(amount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <details>
        <summary className="cursor-pointer font-medium">Event log</summary>
        <table aria-label="Event log" className="mt-2 w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="font-normal">Time</th>
              <th className="font-normal">Source</th>
              <th className="text-right font-normal">Pre</th>
              <th className="text-right font-normal">Post</th>
              <th className="font-normal">Crit</th>
              <th className="font-normal">Buffs</th>
            </tr>
          </thead>
          <tbody>
            {result.fight.trace.map((t, i) => (
              <tr key={i}>
                <td className="tabular-nums">{t.time.toFixed(2)}</td>
                <td>{t.damage.instance.sourceId}</td>
                <td className="text-right tabular-nums">
                  {n(t.damage.preMitigation)}
                </td>
                <td className="text-right tabular-nums">
                  {n(t.damage.postMitigation)}
                </td>
                <td>{critLabel(t.damage.crit)}</td>
                <td className="text-neutral-600">{t.buffs.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

/** METRIC-010: expected-value attacks are "averaged". */
function critLabel(crit: string) {
  switch (crit) {
    case "crit":
      return "crit";
    case "noCrit":
      return "no";
    case "averaged":
      return "averaged";
    default:
      return "";
  }
}
