import { longTermStack, simulate, type LongTermStack } from "@lol/engine";
import { useMemo, useState } from "react";

import {
  MAX_LEVEL,
  movedItem,
  rankProblem,
  ranksOf,
  totalGold,
  withItem,
  withoutItem,
  type Build,
} from "../model/build";
import { toSimulation } from "../model/simulation";
import { StatsPanel } from "./StatsPanel";
import { useApp, usePatch } from "./context";

const KEYS = ["Q", "W", "E", "R"] as const;

export function BuildEditor(props: { build: Build }) {
  const { build } = props;
  const patch = usePatch();
  const update = useApp((s) => s.updateBuild);
  const target = useApp((s) => s.target);
  const settings = useApp((s) => s.settings);
  const champion = patch.champions[build.champion];
  const [itemQuery, setItemQuery] = useState("");
  const [itemError, setItemError] = useState<string>();
  const change = (next: (b: Build) => Build) => {
    update(build.id, next);
  };

  // BUILD-008: stats at fight start, including item effects that add stats.
  const stats = useMemo(() => {
    const sim = toSimulation(build, target, patch, settings);
    return simulate(sim.attacker, sim.target, { maxDuration: 0 }).stats;
  }, [build, target, patch, settings]);

  if (!champion) return <p>Unknown champion {build.champion}</p>;
  const ranks = ranksOf(build, champion);
  const problem = rankProblem(
    ranks,
    build.level,
    champion,
    patch.constants.ultimateLevels,
  );
  const items = Object.values(patch.items).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  // BUILD-007: inputs only for this build's long-term stacks.
  const stackInputs = build.items
    .map((id) => patch.items[id])
    .flatMap((item) => (item ? [longTermStack(item, champion)] : []))
    .filter((s): s is LongTermStack => s !== undefined)
    .filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i);

  const addItem = (id: string) => {
    const result = withItem(build, id, patch.items);
    if (result.ok) {
      change(() => result.build);
      setItemError(undefined);
      setItemQuery("");
    } else setItemError(result.reason);
  };
  const setRank = (key: (typeof KEYS)[number], value: number) => {
    change((b) => ({ ...b, ranks: { ...ranksOf(b, champion), [key]: value } }));
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
      <div className="space-y-5">
        <h2 className="text-xl font-semibold">
          {build.name} · {champion.name}
        </h2>

        <label className="flex items-center gap-2">
          Level
          <select
            className="rounded border px-2 py-1"
            value={build.level}
            onChange={(e) => {
              change((b) => ({ ...b, level: Number(e.target.value) }));
            }}
          >
            {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-1">
          <legend className="font-medium">Skill ranks</legend>
          <div className="flex flex-wrap items-center gap-3">
            {KEYS.map((k) => (
              <label key={k} className="flex items-center gap-1">
                {k}
                <input
                  type="number"
                  className="w-14 rounded border px-1"
                  min={0}
                  max={champion.abilities[k].maxRank}
                  value={ranks[k]}
                  onChange={(e) => {
                    setRank(k, Number(e.target.value));
                  }}
                />
              </label>
            ))}
            {build.ranks && (
              <button
                type="button"
                className="text-sm underline"
                onClick={() => {
                  change((b) => ({ ...b, ranks: undefined }));
                }}
              >
                Use skill order
              </button>
            )}
          </div>
          {problem && (
            <p role="alert" className="text-sm text-red-700">
              {problem}
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-medium">
            Items · {totalGold(build, patch.items).toLocaleString("en-US")} gold
          </legend>
          <ol className="space-y-1">
            {build.items.map((id, i) => (
              <li
                key={`${id}-${String(i)}`}
                className="flex items-center gap-2"
              >
                <span className="flex-1">{patch.items[id]?.name ?? id}</span>
                <button
                  type="button"
                  className="text-sm"
                  aria-label={`Move ${patch.items[id]?.name ?? id} up`}
                  disabled={i === 0}
                  onClick={() => {
                    change((b) => movedItem(b, i, i - 1));
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-sm text-red-700"
                  aria-label={`Remove ${patch.items[id]?.name ?? id}`}
                  onClick={() => {
                    change((b) => withoutItem(b, i));
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <input
              aria-label="Add item"
              list="item-names"
              className="flex-1 rounded border px-2 py-1"
              placeholder="Add item…"
              value={itemQuery}
              onChange={(e) => {
                setItemQuery(e.target.value);
                const match = items.find((i) => i.name === e.target.value);
                if (match) addItem(match.id);
              }}
            />
            <datalist id="item-names">
              {items.map((i) => (
                <option key={i.id} value={i.name} />
              ))}
            </datalist>
          </div>
          {itemError && (
            <p role="alert" className="text-sm text-red-700">
              {itemError}
            </p>
          )}
        </fieldset>

        {stackInputs.length > 0 && (
          <fieldset className="space-y-1">
            <legend className="font-medium">Long-term stacks</legend>
            {stackInputs.map((s) => (
              <label key={s.id} className="flex items-center gap-2">
                {s.label}
                <input
                  type="number"
                  className="w-20 rounded border px-1"
                  min={0}
                  max={s.max}
                  value={build.stacks[s.id] ?? 0}
                  onChange={(e) => {
                    const value = Math.max(
                      0,
                      Math.min(s.max, Number(e.target.value)),
                    );
                    change((b) => ({
                      ...b,
                      stacks: { ...b.stacks, [s.id]: value },
                    }));
                  }}
                />
              </label>
            ))}
          </fieldset>
        )}

        <label className="flex items-center gap-2">
          Attacker health %
          <input
            type="number"
            className="w-20 rounded border px-1"
            min={1}
            max={100}
            value={Math.round(build.healthFraction * 100)}
            onChange={(e) => {
              const value = Math.max(1, Math.min(100, Number(e.target.value)));
              change((b) => ({ ...b, healthFraction: value / 100 }));
            }}
          />
        </label>
      </div>
      <StatsPanel stats={stats} />
    </div>
  );
}
