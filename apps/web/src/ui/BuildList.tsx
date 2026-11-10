import { KITS } from "@lol/engine";
import { useState } from "react";

import { useApp, usePatch } from "./context";

/** Build list: add (attackers with kits only, BUILD-009), select, rename, duplicate, delete. */
export function BuildList(props: {
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  const patch = usePatch();
  const builds = useApp((s) => s.builds);
  const addBuild = useApp((s) => s.addBuild);
  const duplicate = useApp((s) => s.duplicateBuild);
  const rename = useApp((s) => s.renameBuild);
  const remove = useApp((s) => s.deleteBuild);
  const attackers = Object.keys(KITS).filter((id) => patch.champions[id]);
  const [champion, setChampion] = useState(attackers[0] ?? "");

  return (
    <section aria-label="Builds" className="space-y-3">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="new-build-champion">
          Champion
        </label>
        <select
          id="new-build-champion"
          className="rounded border px-2 py-1"
          value={champion}
          onChange={(e) => {
            setChampion(e.target.value);
          }}
        >
          {attackers.map((id) => (
            <option key={id} value={id}>
              {patch.champions[id]?.name ?? id}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded bg-neutral-900 px-3 py-1 text-white"
          disabled={!champion}
          onClick={() => {
            props.onSelect(addBuild(champion).id);
          }}
        >
          Add build
        </button>
      </div>
      <ul className="space-y-1">
        {builds.map((b) => (
          <li
            key={b.id}
            className={`flex items-center gap-1 rounded px-2 py-1 ${
              b.id === props.selected ? "bg-neutral-100" : ""
            }`}
          >
            <input
              aria-label="Build name"
              className="min-w-0 flex-1 bg-transparent"
              value={b.name}
              onFocus={() => {
                props.onSelect(b.id);
              }}
              onChange={(e) => {
                rename(b.id, e.target.value);
              }}
            />
            <button
              type="button"
              className="text-sm text-neutral-600"
              onClick={() => {
                duplicate(b.id);
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="text-sm text-red-700"
              onClick={() => {
                remove(b.id);
                if (props.selected === b.id) props.onSelect(undefined);
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
