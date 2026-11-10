import type { CurvePoint } from "@lol/engine";
import { useState } from "react";

const W = 640;
const H = 240;
const PAD = { left: 52, right: 96, top: 12, bottom: 28 };
/** Categorical slots in fixed order (index.css); more builds than this share the last. */
const SLOTS = 8;

export interface Series {
  id: string;
  label: string;
  curve: CurvePoint[];
}

function ticks(max: number, count = 4) {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
}

const color = (i: number) =>
  `var(--series-${String(Math.min(i, SLOTS - 1) + 1)})`;

/** Cumulative damage at `time` (a step function of the curve). */
function valueAt(curve: readonly CurvePoint[], time: number) {
  let v = 0;
  for (const p of curve) {
    if (p.time > time) break;
    v = p.cumulative;
  }
  return v;
}

/**
 * METRIC-004, CMP-009: cumulative damage over time, one line per build, with an optional
 * reference line (the target's effective health).
 */
export function DamageChart(props: {
  series: Series[];
  duration: number;
  reference?: { value: number; label: string };
}) {
  const { series, duration, reference } = props;
  const [hover, setHover] = useState<number>();
  const maxY = Math.max(
    1,
    reference?.value ?? 0,
    ...series.flatMap((s) => s.curve.map((p) => p.cumulative)),
  );
  const yTicks = ticks(maxY);
  const top = Math.max(maxY, yTicks.at(-1) ?? maxY);
  const xTicks = ticks(duration, 5);
  const x = (t: number) =>
    PAD.left + (t / duration) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - (v / top) * (H - PAD.top - PAD.bottom);

  // Step lines: damage jumps at each instance.
  const path = (curve: readonly CurvePoint[]) => {
    let d = `M${String(x(0))},${String(y(0))}`;
    let prev = 0;
    for (const p of curve) {
      d += `L${String(x(p.time))},${String(y(prev))}L${String(x(p.time))},${String(y(p.cumulative))}`;
      prev = p.cumulative;
    }
    return d;
  };
  const many = series.length > 1;
  const labelled = series.length <= 4;
  // Direct labels at each line's end, pushed apart so they never overlap.
  const labelY = new Map<string, number>();
  {
    const ends = series
      .flatMap((s) => {
        const last = s.curve.at(-1);
        return last ? [{ id: s.id, y: y(last.cumulative) }] : [];
      })
      .sort((a, b) => a.y - b.y);
    let prevY = -Infinity;
    for (const e of ends) {
      const placed = Math.max(e.y, prevY + 13, PAD.top + 6);
      labelY.set(e.id, placed);
      prevY = placed;
    }
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t =
      ((((e.clientX - box.left) / box.width) * W - PAD.left) /
        (W - PAD.left - PAD.right)) *
      duration;
    setHover(Math.max(0, Math.min(duration, t)));
  };

  return (
    <figure className="viz-root relative rounded bg-[var(--surface-1)] p-2">
      <figcaption className="mb-1 text-sm font-medium text-[var(--text-primary)]">
        Cumulative damage
      </figcaption>
      {many && (
        <ul aria-label="Legend" className="mb-1 flex flex-wrap gap-3 text-xs">
          {series.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-1 text-[var(--text-secondary)]"
            >
              <span
                aria-hidden
                className="inline-block h-0.5 w-4"
                style={{ background: color(i) }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="w-full touch-none"
        role="img"
        aria-label="Cumulative post-mitigation damage over time"
        onPointerMove={onMove}
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
              {Math.round(v).toLocaleString("en-US")}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-secondary)"
          >
            {t}s
          </text>
        ))}
        {reference && (
          <g data-testid="reference-line">
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(reference.value)}
              y2={y(reference.value)}
              stroke="var(--text-secondary)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={PAD.left + 4}
              y={y(reference.value) - 4}
              fontSize={11}
              fill="var(--text-secondary)"
            >
              {reference.label}
            </text>
          </g>
        )}
        {series.map((s, i) => {
          const last = s.curve.at(-1);
          return (
            <g key={s.id}>
              <path
                d={path(s.curve)}
                fill="none"
                stroke={color(i)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {last && (
                <circle
                  cx={x(last.time)}
                  cy={y(last.cumulative)}
                  r={4}
                  fill={color(i)}
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                />
              )}
              {many && labelled && last && (
                <text
                  x={x(last.time) + 8}
                  y={labelY.get(s.id) ?? y(last.cumulative)}
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="var(--text-primary)"
                >
                  {s.label}
                </text>
              )}
            </g>
          );
        })}
        {hover !== undefined && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--text-secondary)"
              strokeWidth={1}
            />
            {series.map((s, i) => (
              <circle
                key={s.id}
                cx={x(hover)}
                cy={y(valueAt(s.curve, hover))}
                r={4}
                fill={color(i)}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            ))}
          </g>
        )}
      </svg>
      {hover !== undefined && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-6 rounded border border-[var(--grid)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-primary)] shadow-sm"
          style={{ left: `${String((x(hover) / W) * 100)}%` }}
        >
          <div className="text-[var(--text-secondary)]">
            {hover.toFixed(2)}s
          </div>
          {series.map((s) => (
            <div key={s.id} className="tabular-nums">
              {many && `${s.label}: `}
              {Math.round(valueAt(s.curve, hover)).toLocaleString("en-US")}{" "}
              damage
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}
