import type { PatchData } from "@lol/data";
import { useMemo, useState } from "react";

import { loadLatest } from "./data";
import { createAppStore, type AppStore } from "./model/store";
import { defaultRunner, type Runner } from "./worker/runner";
import { BuildEditor } from "./ui/BuildEditor";
import { BuildList } from "./ui/BuildList";
import { useApp, usePatch } from "./ui/context";
import { Providers } from "./ui/Providers";
import { Compare } from "./ui/Compare";
import { Results } from "./ui/Results";
import { TargetEditor } from "./ui/TargetEditor";
import { Timeline } from "./ui/Timeline";

const defaultStore = createAppStore();

/** Edits settle for this long before results recompute (CMP-006). */
const DEBOUNCE_MS = 150;

export function App(props: {
  store?: AppStore;
  patch?: PatchData;
  runner?: Runner;
  debounceMs?: number;
}) {
  const [patch] = useState(() => props.patch ?? loadLatest());
  const [runner] = useState(() => ({
    runner: props.runner ?? defaultRunner(patch),
    debounceMs: props.debounceMs ?? DEBOUNCE_MS,
  }));
  return (
    <Providers
      store={props.store ?? defaultStore}
      patch={patch}
      runner={runner}
    >
      <Shell />
    </Providers>
  );
}

function Shell() {
  const patch = usePatch();
  const builds = useApp((s) => s.builds);
  const compared = useApp((s) => s.compared);
  const comparedBuilds = useMemo(
    () =>
      compared.flatMap((id) => {
        const b = builds.find((x) => x.id === id);
        return b ? [b] : [];
      }),
    [builds, compared],
  );
  const gameTime = useApp((s) => s.settings.gameTime);
  const setSettings = useApp((s) => s.setSettings);
  const [selected, setSelected] = useState<string>();
  const build = builds.find((b) => b.id === selected) ?? builds[0];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold">LoL DPS Sim</h1>
        <div className="flex items-center gap-4 text-sm text-neutral-600">
          <label className="flex items-center gap-2">
            Game time (min)
            <input
              type="number"
              className="w-16 rounded border px-1"
              min={0}
              value={gameTime}
              onChange={(e) => {
                setSettings({ gameTime: Math.max(0, Number(e.target.value)) });
              }}
            />
          </label>
          <span>Patch {patch.patch}</span>
        </div>
      </header>
      <div className="grid gap-8 md:grid-cols-[18rem_1fr]">
        <BuildList selected={build?.id} onSelect={setSelected} />
        {build ? (
          <div className="space-y-8">
            <BuildEditor build={build} />
            <TargetEditor />
            {comparedBuilds.length > 1 && <Compare builds={comparedBuilds} />}
            <Timeline builds={comparedBuilds} />
            <Results build={build} />
          </div>
        ) : (
          <p className="text-neutral-600">Add a build to start.</p>
        )}
      </div>
    </main>
  );
}
