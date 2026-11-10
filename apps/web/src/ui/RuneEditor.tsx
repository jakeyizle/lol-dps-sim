import type { RuneTree } from "@lol/data";
import { pageProblem, type RunePage } from "@lol/engine";

import { usePatch } from "./context";

/** RUNE-001: primary tree, keystone, one rune per row; secondary tree (2 rows); 3 shards. */
export function RuneEditor(props: {
  page: RunePage;
  onChange: (page: RunePage) => void;
  /** Prefixes every control's label, e.g. "Target " (several editors on one page). */
  prefix?: string;
}) {
  const { page, onChange, prefix = "" } = props;
  const patch = usePatch();
  const name = (id: number) => patch.runes[String(id)]?.name ?? String(id);
  const tree = (id: number) => patch.trees.find((t) => t.id === id);
  const primary = tree(page.primary);
  const secondary = tree(page.secondary);
  const problem = pageProblem(page, patch.trees, patch.shards);

  const firstOf = (t: RuneTree) => ({
    keystone: t.slots[0]?.[0] ?? 0,
    primaryRunes: t.slots.slice(1).map((row) => row[0] ?? 0),
  });
  const setPrimary = (id: number) => {
    const t = tree(id);
    if (!t) return;
    const other =
      page.secondary === id
        ? patch.trees.find((x) => x.id !== id)
        : tree(page.secondary);
    onChange({
      ...page,
      primary: id,
      ...firstOf(t),
      secondary: other?.id ?? page.secondary,
      secondaryRunes:
        other && other.id !== page.secondary
          ? other.slots.slice(1, 3).map((row) => row[0] ?? 0)
          : page.secondaryRunes,
    });
  };
  const setSecondary = (id: number) => {
    const t = tree(id);
    if (!t) return;
    onChange({
      ...page,
      secondary: id,
      secondaryRunes: t.slots.slice(1, 3).map((row) => row[0] ?? 0),
    });
  };
  const select = (
    label: string,
    value: number | "",
    options: readonly number[],
    set: (id: number | undefined) => void,
    optional = false,
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-28 text-neutral-600">{label}</span>
      <select
        aria-label={prefix + label}
        className="rounded border px-1 py-0.5"
        value={value}
        onChange={(e) => {
          set(e.target.value === "" ? undefined : Number(e.target.value));
        }}
      >
        {optional && <option value="">—</option>}
        {options.map((id) => (
          <option key={id} value={id}>
            {name(id)}
          </option>
        ))}
      </select>
    </label>
  );
  const treeSelect = (
    label: string,
    value: number,
    set: (id: number) => void,
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-28 text-neutral-600">{label}</span>
      <select
        aria-label={prefix + label}
        className="rounded border px-1 py-0.5"
        value={value}
        onChange={(e) => {
          set(Number(e.target.value));
        }}
      >
        {patch.trees.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">{prefix}Runes</legend>
      <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
        <div className="space-y-1">
          {treeSelect("Primary tree", page.primary, setPrimary)}
          {primary &&
            select("Keystone", page.keystone, primary.slots[0] ?? [], (id) => {
              if (id !== undefined) onChange({ ...page, keystone: id });
            })}
          {primary?.slots.slice(1).map((row, i) =>
            select(
              `Primary row ${String(i + 1)}`,
              page.primaryRunes[i] ?? "",
              row,
              (id) => {
                if (id === undefined) return;
                const primaryRunes = [...page.primaryRunes];
                primaryRunes[i] = id;
                onChange({ ...page, primaryRunes });
              },
            ),
          )}
        </div>
        <div className="space-y-1">
          {treeSelect("Secondary tree", page.secondary, setSecondary)}
          {secondary?.slots.slice(1).map((row, i) =>
            select(
              `Secondary row ${String(i + 1)}`,
              row.find((id) => page.secondaryRunes.includes(id)) ?? "",
              row,
              (id) => {
                const kept = page.secondaryRunes.filter(
                  (r) => !row.includes(r),
                );
                onChange({
                  ...page,
                  secondaryRunes: id === undefined ? kept : [...kept, id],
                });
              },
              true,
            ),
          )}
          {patch.shards.map((row, i) =>
            select(
              `Shard ${String(i + 1)}`,
              page.shards[i] ?? "",
              row,
              (id) => {
                if (id === undefined) return;
                const shards = [...page.shards];
                shards[i] = id;
                onChange({ ...page, shards });
              },
            ),
          )}
        </div>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-red-700">
          {problem}
        </p>
      )}
    </fieldset>
  );
}
