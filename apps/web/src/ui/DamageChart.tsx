import type { CurvePoint } from "@lol/engine";
import { useState } from "react";

const W = 640;
const H = 220;
const PAD = { left: 52, right: 16, top: 12, bottom: 28 };

function ticks(max: number, count = 4) {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
}

/** METRIC-004: cumulative damage over time, one series (the title names it). */
export function DamageChart(props: { curve: CurvePoint[]; duration: number }) {
  const { curve, duration } = props;
  const [hover, setHover] = useState<number>();
  const maxY = Math.max(1, ...curve.map((p) => p.cumulative));
  const yTicks = ticks(maxY);
  const top = Math.max(maxY, yTicks.at(-1) ?? maxY);
  const xTicks = ticks(duration, 5);
  const x = (t: number) =>
    PAD.left + (t / duration) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - (v / top) * (H - PAD.top - PAD.bottom);

  // Step line: damage jumps at each instance.
  let d = `M${String(x(0))},${String(y(0))}`;
  let prev = 0;
  for (const p of curve) {
    d += `L${String(x(p.time))},${String(y(prev))}L${String(x(p.time))},${String(y(p.cumulative))}`;
    prev = p.cumulative;
  }
  const last = curve.at(-1);
  const point = hover === undefined ? undefined : curve[hover];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t =
      ((((e.clientX - box.left) / box.width) * W - PAD.left) /
        (W - PAD.left - PAD.right)) *
      duration;
    let best: number | undefined;
    curve.forEach((p, i) => {
      if (
        best === undefined ||
        Math.abs(p.time - t) < Math.abs((curve[best]?.time ?? 0) - t)
      )
        best = i;
    });
    setHover(best);
  };

  return (
    <figure className="viz-root relative">
      <figcaption className="mb-1 text-sm font-medium text-[var(--text-primary)]">
        Cumulative damage
      </figcaption>
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
        <path
          d={d}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {last && (
          <circle
            cx={x(last.time)}
            cy={y(last.cumulative)}
            r={4}
            fill="var(--series-1)"
            stroke="var(--surface-1)"
            strokeWidth={2}
          />
        )}
        {point && (
          <g pointerEvents="none">
            <line
              x1={x(point.time)}
              x2={x(point.time)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--text-secondary)"
              strokeWidth={1}
            />
            <circle
              cx={x(point.time)}
              cy={y(point.cumulative)}
              r={4}
              fill="var(--series-1)"
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      {point && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-6 rounded border border-[var(--grid)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-primary)] shadow-sm"
          style={{ left: `${String((x(point.time) / W) * 100)}%` }}
        >
          {point.time.toFixed(2)}s ·{" "}
          {Math.round(point.cumulative).toLocaleString("en-US")} damage
        </div>
      )}
    </figure>
  );
}
