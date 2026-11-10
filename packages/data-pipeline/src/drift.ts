export interface Drift {
  changed: { path: string; from: unknown; to: unknown }[];
  added: string[];
  removed: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** DATA-008: objects are compared key by key; arrays and primitives as whole values. */
export function diff(from: unknown, to: unknown, path = ""): Drift {
  const drift: Drift = { changed: [], added: [], removed: [] };
  const join = (key: string) => (path ? `${path}.${key}` : key);

  if (!isObject(from) || !isObject(to)) {
    if (JSON.stringify(from) !== JSON.stringify(to))
      drift.changed.push({ path, from, to });
    return drift;
  }
  for (const key of Object.keys(from))
    if (!(key in to)) drift.removed.push(join(key));
  for (const [key, value] of Object.entries(to)) {
    if (!(key in from)) {
      drift.added.push(join(key));
      continue;
    }
    const inner = diff(from[key], value, join(key));
    drift.changed.push(...inner.changed);
    drift.added.push(...inner.added);
    drift.removed.push(...inner.removed);
  }
  return drift;
}

/** Raw game formulas can be huge; the report shows the start of long values. */
const MAX_SHOWN = 120;

export function formatDrift(drift: Drift) {
  const show = (v: unknown) => {
    const text = JSON.stringify(v);
    return text.length > MAX_SHOWN ? `${text.slice(0, MAX_SHOWN)}…` : text;
  };
  return [
    ...drift.changed.map(
      (c) => `changed ${c.path}: ${show(c.from)} → ${show(c.to)}`,
    ),
    ...drift.added.map((p) => `added ${p}`),
    ...drift.removed.map((p) => `removed ${p}`),
  ];
}

const parts = (patch: string) => patch.split(".").map(Number);
const compare = (a: string, b: string) => {
  const [a1 = 0, a2 = 0] = parts(a);
  const [b1 = 0, b2 = 0] = parts(b);
  return a1 - b1 || a2 - b2;
};

/** The newest generated patch older than `current`, if any. */
export function previousPatch(available: readonly string[], current: string) {
  return available
    .filter((p) => /^\d+\.\d+$/.test(p) && compare(p, current) < 0)
    .sort(compare)
    .at(-1);
}

/** DATA-007: dot paths each entity's effect code reads, checked against its generated data. */
export function missingValues(
  entities: Record<string, unknown>,
  required: Record<string, readonly string[]>,
) {
  const problems: string[] = [];
  for (const [id, paths] of Object.entries(required)) {
    const entity = entities[id];
    if (entity === undefined) {
      problems.push(`${id}: required by effect code but not generated`);
      continue;
    }
    for (const path of paths) {
      let node: unknown = entity;
      for (const key of path.split("."))
        node = isObject(node) ? node[key] : undefined;
      if (node === undefined) problems.push(`${id}: missing value ${path}`);
    }
  }
  return problems;
}
