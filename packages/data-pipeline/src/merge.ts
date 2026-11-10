const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Deep-merges `override` onto `base`; arrays and primitives replace (DATA-005). */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (!isObject(base) || !isObject(override)) return override;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override))
    out[key] = deepMerge(base[key], value);
  return out;
}
