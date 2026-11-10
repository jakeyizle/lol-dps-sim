/** Round axis ticks from 0; the last one is at or above `max`. */
export function ticks(max: number, count = 4) {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from(
    { length: Math.ceil(max / step - 1e-9) + 1 },
    (_, i) => i * step,
  );
}
