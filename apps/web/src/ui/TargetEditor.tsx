import type { DefensiveStat } from "@lol/engine";
import { hasDefensiveKit, ZHONYAS_HOURGLASS } from "@lol/engine";
import { useState } from "react";

import {
  championTarget,
  championTargetStats,
  DEFAULT_ZHONYA_BELOW,
  defaultDummy,
  firstPage,
  shippedPresets,
  type ChampionTarget,
  type DummyTarget,
  type Target,
} from "../model/target";
import { useApp, usePatch } from "./context";
import { RuneEditor } from "./RuneEditor";

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const input = "w-24 rounded border px-1";

/** TGT-001–005: a dummy or any champion (BUILD-009), plus presets. */
export function TargetEditor() {
  const target = useApp((s) => s.target);
  const setTarget = useApp((s) => s.setTarget);
  const patch = usePatch();
  const champions = Object.values(patch.targets).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const setKind = (kind: Target["kind"]) => {
    if (kind === target.kind) return;
    const [first] = champions;
    if (kind === "dummy") setTarget(defaultDummy);
    else if (first) setTarget(championTarget(first.id));
  };

  return (
    <fieldset aria-label="Target" className="space-y-3">
      <legend className="font-medium">Target</legend>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          Kind
          <select
            aria-label="Target kind"
            className="rounded border px-1 py-0.5"
            value={target.kind}
            onChange={(e) => {
              setKind(e.target.value === "dummy" ? "dummy" : "champion");
            }}
          >
            <option value="dummy">Target dummy</option>
            <option value="champion">Champion</option>
          </select>
        </label>
        <Presets />
      </div>
      {target.kind === "dummy" ? (
        <DummyFields target={target} onChange={setTarget} />
      ) : (
        <ChampionFields target={target} onChange={setTarget} />
      )}
    </fieldset>
  );
}

function Presets() {
  const setTarget = useApp((s) => s.setTarget);
  const saved = useApp((s) => s.targetPresets);
  const save = useApp((s) => s.saveTargetPreset);
  const [name, setName] = useState("");
  const all = [...shippedPresets, ...saved];
  return (
    <>
      <label className="flex items-center gap-2">
        Preset
        <select
          aria-label="Target preset"
          className="rounded border px-1 py-0.5"
          value=""
          onChange={(e) => {
            const preset = all.find((p) => p.name === e.target.value);
            if (preset) setTarget(preset.target);
          }}
        >
          <option value="">Choose…</option>
          {all.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          save(trimmed);
          setName("");
        }}
      >
        <input
          aria-label="Preset name"
          placeholder="Preset name"
          className="w-32 rounded border px-1"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <button type="submit" className="rounded border px-2">
          Save preset
        </button>
      </form>
    </>
  );
}

/** TGT-002. */
function DummyFields(props: {
  target: DummyTarget;
  onChange: (t: Target) => void;
}) {
  const { target, onChange } = props;
  const field = (
    key: "health" | "armor" | "magicResist",
    label: string,
    min: number,
  ) => (
    <label className="flex items-center gap-2">
      {label}
      <input
        type="number"
        className={input}
        min={min}
        value={target[key]}
        onChange={(e) => {
          onChange({ ...target, [key]: Math.max(min, Number(e.target.value)) });
        }}
      />
    </label>
  );
  return (
    <div className="flex flex-wrap gap-4">
      {field("health", "Health", 1)}
      {field("armor", "Armor", -200)}
      {field("magicResist", "Magic resist", -200)}
      <label className="flex items-center gap-2">
        Damage reduction %
        <input
          type="number"
          className={input}
          min={0}
          max={100}
          value={Math.round(target.damageReduction * 1000) / 10}
          onChange={(e) => {
            const percent = Math.max(0, Math.min(100, Number(e.target.value)));
            onChange({ ...target, damageReduction: percent / 100 });
          }}
        />
      </label>
    </div>
  );
}

const OVERRIDES: readonly [DefensiveStat, string][] = [
  ["health", "Health"],
  ["armor", "Armor"],
  ["magicResist", "Magic resist"],
];

/** TGT-001, TGT-003, TGT-012, BUILD-009. */
function ChampionFields(props: {
  target: ChampionTarget;
  onChange: (t: Target) => void;
}) {
  const { target, onChange } = props;
  const patch = usePatch();
  const gameTime = useApp((s) => s.settings.gameTime);
  const champions = Object.values(patch.targets).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const items = Object.values(patch.items).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const stats = championTargetStats(target, patch, gameTime);
  const name = patch.targets[target.champion]?.name ?? target.champion;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          Target champion
          <select
            aria-label="Target champion"
            className="rounded border px-1 py-0.5"
            value={target.champion}
            onChange={(e) => {
              onChange({ ...target, champion: e.target.value });
            }}
          >
            {champions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {hasDefensiveKit(c.id) ? "" : " (stats only)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Target level
          <input
            type="number"
            aria-label="Target level"
            className="w-16 rounded border px-1"
            min={1}
            max={18}
            value={target.level}
            onChange={(e) => {
              const level = Math.max(1, Math.min(18, Number(e.target.value)));
              onChange({ ...target, level });
            }}
          />
        </label>
      </div>
      {!hasDefensiveKit(target.champion) && (
        <p className="text-sm text-neutral-600" data-testid="stats-only">
          Stats only: {name}&apos;s passive and abilities aren&apos;t modelled.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Add target item"
          className="rounded border px-1 py-0.5"
          value=""
          onChange={(e) => {
            if (e.target.value)
              onChange({ ...target, items: [...target.items, e.target.value] });
          }}
        >
          <option value="">Add item…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {target.items.map((id, index) => (
          <button
            key={`${id}-${String(index)}`}
            type="button"
            className="rounded border px-2 text-sm"
            aria-label={`Remove ${patch.items[id]?.name ?? id} from target`}
            onClick={() => {
              onChange({
                ...target,
                items: target.items.filter((_, i) => i !== index),
              });
            }}
          >
            {patch.items[id]?.name ?? id} ×
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        {OVERRIDES.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            {label} override
            <input
              type="number"
              className={input}
              placeholder="—"
              value={target.overrides[key] ?? ""}
              onChange={(e) => {
                // Empty clears the override.
                const value =
                  e.target.value === "" ? undefined : Number(e.target.value);
                onChange({
                  ...target,
                  overrides: { ...target.overrides, [key]: value },
                });
              }}
            />
          </label>
        ))}
      </div>

      {target.items.includes(ZHONYAS_HOURGLASS) && (
        <label className="flex items-center gap-2">
          Zhonya&apos;s at
          <select
            aria-label="Zhonya's activation"
            className="rounded border px-1 py-0.5"
            value={
              target.zhonyaBelow === null ? "never" : String(target.zhonyaBelow)
            }
            onChange={(e) => {
              onChange({
                ...target,
                zhonyaBelow:
                  e.target.value === "never" ? null : Number(e.target.value),
              });
            }}
          >
            <option value="never">Never</option>
            {[0.1, 0.2, DEFAULT_ZHONYA_BELOW, 0.4, 0.5].map((f) => (
              <option key={f} value={String(f)}>
                {Math.round(f * 100)}% health
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={target.runes !== undefined}
          onChange={(e) => {
            onChange({
              ...target,
              runes: e.target.checked
                ? firstPage(patch.trees, patch.shards)
                : undefined,
            });
          }}
        />
        Target runes
      </label>
      {target.runes && (
        <RuneEditor
          prefix="Target "
          page={target.runes}
          onChange={(runes) => {
            onChange({ ...target, runes });
          }}
        />
      )}

      <p className="text-sm" data-testid="target-stats">
        <span data-target-stat="health">{n(stats.health.total)}</span> health ·{" "}
        <span data-target-stat="armor">{n(stats.armor.total)}</span> armor ·{" "}
        <span data-target-stat="magicResist">{n(stats.magicResist.total)}</span>{" "}
        magic resist
      </p>
    </div>
  );
}
