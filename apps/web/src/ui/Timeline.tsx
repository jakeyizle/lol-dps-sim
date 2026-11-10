import type { Analysis } from "@lol/engine";
import { useMemo, useState } from "react";

import {
  timelineSteps,
  totalGold,
  withTimelineLevel,
  type Build,
} from "../model/build";
import { ticks } from "./chart";
import { useApp, usePatch } from "./context";
import { useAnalyses } from "./useAnalysis";

const n = (x: number) => Math.round(x).toLocaleString("en-US");

/** A build's steps, cached per build object so unchanged builds keep their jobs. */
const stepsCache = new WeakMap<Build, Build[]>();
function stepsOf(build: Build) {
  let steps = stepsCache.get(build);
  if (!steps) {
    steps = timelineSteps(build);
    stepsCache.set(build, steps);
  }
  return steps;
}

type Metric = { kind: "ttk" } | { kind: "dps"; seconds: number };

function metricValue(metric: Metric, a: Analysis): number | undefined {
  if (metric.kind === "ttk") return a.killed ? (a.ttk ?? undefined) : undefined;
  return a.dps.find((w) => w.seconds === metric.seconds)?.dps;
}
const formatMetric = (metric: Metric, v: number | undefined) =>
  v === undefined
    ? "Not killed"
    : metric.kind === "ttk"
      ? `${v.toFixed(2)}s`
      : n(v);

/** CMP-002, CMP-003, CMP-010: each build with its first 1, 2, … k items. */
export function Timeline(props: { builds: readonly Build[] }) {
  const patch = usePatch();
  const windows = useApp((s) => s.settings.dpsWindows);
  const update = useApp((s) => s.updateBuild);
  const [metric, setMetric] = useState<Metric>({ kind: "ttk" });
  const withItems = props.builds.filter((b) => b.items.length > 0);
  const steps = useMemo(() => withItems.flatMap(stepsOf), [withItems]);
  const analyses = useAnalyses(steps);
  const byId = new Map(analyses.map((a) => [a.build.id, a]));
  const stale = analyses.some((a) => a.stale);
  const width = Math.max(0, ...withItems.map((b) => b.items.length));

  if (withItems.length === 0) return null;
  const rows = withItems.map((build) => ({
    build,
    cells: stepsOf(build).map((step) => {
      const result = byId.get(step.id)?.result;
      return {
        step,
        value: result ? metricValue(metric, result) : undefined,
        ready: result !== undefined,
        gold: totalGold(step, patch.items),
      };
    }),
  }));

  return (
    <section
      aria-label="Item timeline"
      aria-busy={stale}
      className={`space-y-3 transition-opacity ${stale ? "opacity-50" : ""}`}
    >
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="text-xl font-semibold">Item timeline</h2>
        <label className="flex items-center gap-2 text-sm">
          Metric
          <select
            aria-label="Timeline metric"
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
        {stale && (
          <p role="status" className="text-sm text-neutral-600">
            Updating…
          </p>
        )}
      </div>
      <TimelineChart
        metric={metric}
        rows={rows.map((r) => ({
          id: r.build.id,
          label: r.build.name,
          points: r.cells.map((c) => ({ value: c.value, gold: c.gold })),
        }))}
        width={width}
      />
      <div className="overflow-x-auto">
        <table aria-label="Timeline table" className="text-sm">
          <thead>
            <tr>
              <th />
              {Array.from({ length: width }, (_, i) => (
                <th key={i} scope="col" className="px-3 text-left font-normal">
                  {i + 1} {i === 0 ? "item" : "items"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ build, cells }) => (
              <tr key={build.id} className="border-t border-neutral-200">
                <th scope="row" className="pr-4 text-left font-normal">
                  {build.name}
                </th>
                {cells.map((c, i) => (
                  <td key={c.step.id} className="px-3 py-1 align-top">
                    <div className="tabular-nums" data-step-metric>
                      {c.ready ? formatMetric(metric, c.value) : "…"}
                    </div>
                    <div className="text-xs text-neutral-600 tabular-nums">
                      {n(c.gold)} gold
                    </div>
                    <label className="flex items-center gap-1 text-xs text-neutral-600">
                      Lv
                      <input
                        type="number"
                        aria-label={`${build.name} step ${String(i + 1)} level`}
                        className="w-12 rounded border px-1"
                        min={1}
                        max={18}
                        value={c.step.level}
                        onChange={(e) => {
                          update(build.id, (b) =>
                            withTimelineLevel(b, i, Number(e.target.value)),
                          );
                        }}
                      />
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const W = 640;
const H = 200;
const PAD = { left: 52, right: 96, top: 12, bottom: 28 };

/** One line per build over item count; values are also in the table. */
function TimelineChart(props: {
  metric: Metric;
  rows: {
    id: string;
    label: string;
    points: { value: number | undefined; gold: number }[];
  }[];
  width: number;
}) {
  const { metric, rows, width } = props;
  const [hover, setHover] = useState<{ row: number; step: number }>();
  const values = rows.flatMap((r) =>
    r.points.flatMap((p) => (p.value === undefined ? [] : [p.value])),
  );
  const yTicks = ticks(Math.max(1, ...values) * 1.05);
  const top = yTicks.at(-1) ?? 1;
  const x = (step: number) =>
    PAD.left +
    (width <= 1 ? 0.5 : step / (width - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - (v / top) * (H - PAD.top - PAD.bottom);
  const color = (i: number) => `var(--series-${String(Math.min(i, 7) + 1)})`;
  const point =
    hover === undefined ? undefined : rows[hover.row]?.points[hover.step];

  return (
    <figure className="viz-root relative rounded bg-[var(--surface-1)] p-2">
      <figcaption className="mb-1 text-sm font-medium text-[var(--text-primary)]">
        {metric.kind === "ttk" ? "TTK (s)" : `DPS ${String(metric.seconds)}s`}{" "}
        by item count
      </figcaption>
      {rows.length > 1 && (
        <ul aria-label="Legend" className="mb-1 flex flex-wrap gap-3 text-xs">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className="flex items-center gap-1 text-[var(--text-secondary)]"
            >
              <span
                aria-hidden
                className="inline-block h-0.5 w-4"
                style={{ background: color(i) }}
              />
              {r.label}
            </li>
          ))}
        </ul>
      )}
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="w-full"
        role="img"
        aria-label="Metric by item count"
        onPointerLeave={() => {
          setHover(undefined);
        }}
      >
        <rect width={W} height={H} fill="var(--surface-1)" />
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--text-secondary)"
            >
              {metric.kind === "ttk" ? v.toFixed(1) : n(v)}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="var(--grid)"
        />
        {Array.from({ length: width }, (_, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-secondary)"
          >
            {i + 1}
          </text>
        ))}
        {rows.map((r, ri) => {
          const pts = r.points.flatMap((p, i) =>
            p.value === undefined ? [] : [{ i, v: p.value }],
          );
          const last = pts.at(-1);
          return (
            <g key={r.id}>
              <polyline
                points={pts
                  .map((p) => `${String(x(p.i))},${String(y(p.v))}`)
                  .join(" ")}
                fill="none"
                stroke={color(ri)}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {pts.map((p) => (
                <circle
                  key={p.i}
                  cx={x(p.i)}
                  cy={y(p.v)}
                  r={hover?.row === ri && hover.step === p.i ? 6 : 4}
                  fill={color(ri)}
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                  onPointerEnter={() => {
                    setHover({ row: ri, step: p.i });
                  }}
                />
              ))}
              {rows.length > 1 && rows.length <= 4 && last && (
                <text
                  x={x(last.i) + 8}
                  y={y(last.v)}
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="var(--text-primary)"
                >
                  {r.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && point && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-6 rounded border border-[var(--grid)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-primary)] shadow-sm"
          style={{ left: `${String((x(hover.step) / W) * 100)}%` }}
        >
          {rows[hover.row]?.label} · {hover.step + 1} items ·{" "}
          {formatMetric(metric, point.value)} · {n(point.gold)} gold
        </div>
      )}
    </figure>
  );
}
