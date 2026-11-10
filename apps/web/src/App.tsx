import type { PatchData } from "@lol/data";
import { useEffect, useMemo, useState } from "react";

import { loadLatest } from "./data";
import { browserStorage, createPersistentStore } from "./model/persist";
import { decodeShare, shareFromHash } from "./model/share";
import { createAppStore, type AppStore } from "./model/store";
import { defaultRunner, type Runner } from "./worker/runner";
import { BuildEditor } from "./ui/BuildEditor";
import { BuildList } from "./ui/BuildList";
import { useApp, usePatch } from "./ui/context";
import { Providers } from "./ui/Providers";
import { Compare } from "./ui/Compare";
import { Matrix } from "./ui/Matrix";
import { Results } from "./ui/Results";
import { ShareButton, SharedBanner } from "./ui/Share";
import { TargetEditor } from "./ui/TargetEditor";
import { Timeline } from "./ui/Timeline";

/** Edits settle for this long before results recompute (CMP-006). */
const DEBOUNCE_MS = 150;

export function App(props: {
  store?: AppStore;
  patch?: PatchData;
  runner?: Runner;
  debounceMs?: number;
  /** The location hash to read a share link from (default: the page's). */
  hash?: string;
}) {
  const [patch] = useState(() => props.patch ?? loadLatest());
  // SAVE-001: without a store from the caller, work is kept in localStorage.
  const [saved] = useState(
    () => props.store ?? createPersistentStore(browserStorage(), patch),
  );
  // SAVE-007: a share link opens in its own store; saved work stays as it is.
  const [shared, setShared] = useState<AppStore>();
  const [runner] = useState(() => ({
    runner: props.runner ?? defaultRunner(patch),
    debounceMs: props.debounceMs ?? DEBOUNCE_MS,
  }));
  const hash = props.hash ?? window.location.hash;

  useEffect(() => {
    const value = shareFromHash(hash);
    if (!value) return;
    let cancelled = false;
    void decodeShare(value, patch).then((r) => {
      if (cancelled) return;
      if (r.ok)
        setShared(
          createAppStore(undefined, {
            patch: patch.patch,
            saved: {
              ...r.state,
              targetPresets: saved.getState().targetPresets,
            },
            notices: r.notices,
          }),
        );
      // SAVE-004: say so, and keep showing saved work.
      else saved.setState((s) => ({ notices: [...s.notices, r.error] }));
    });
    return () => {
      cancelled = true;
    };
  }, [hash, patch, saved]);

  const leaveShared = () => {
    setShared(undefined);
    try {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    } catch {
      // no history API: the hash stays
    }
  };

  return (
    <Providers store={shared ?? saved} patch={patch} runner={runner}>
      {shared && (
        <SharedBanner shared={shared} saved={saved} onLeave={leaveShared} />
      )}
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
  const critMode = useApp((s) => s.settings.critMode);
  const runs = useApp((s) => s.settings.runs);
  const setSettings = useApp((s) => s.setSettings);
  const [selected, setSelected] = useState<string>();
  const notices = useApp((s) => s.notices);
  const dismissNotices = useApp((s) => s.dismissNotices);
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
          <label className="flex items-center gap-2">
            Crits
            <select
              aria-label="Crit mode"
              className="rounded border px-1 py-0.5"
              value={critMode}
              onChange={(e) => {
                setSettings({
                  critMode: e.target.value === "rng" ? "rng" : "expected",
                });
              }}
            >
              <option value="expected">Expected value</option>
              <option value="rng">Random</option>
            </select>
          </label>
          {critMode === "rng" && (
            <label className="flex items-center gap-2">
              Runs
              <input
                type="number"
                aria-label="RNG runs"
                className="w-20 rounded border px-1"
                min={1}
                max={2000}
                value={runs}
                onChange={(e) => {
                  setSettings({
                    runs: Math.max(
                      1,
                      Math.min(2000, Math.round(Number(e.target.value))),
                    ),
                  });
                }}
              />
            </label>
          )}
          <span>Patch {patch.patch}</span>
          <ShareButton />
        </div>
      </header>
      {notices.length > 0 && (
        <div
          role="status"
          aria-label="Notices"
          className="mb-6 flex items-start justify-between gap-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm"
        >
          <ul className="space-y-1">
            {notices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <button type="button" className="underline" onClick={dismissNotices}>
            Dismiss
          </button>
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-[18rem_1fr]">
        <BuildList selected={build?.id} onSelect={setSelected} />
        {build ? (
          <div className="space-y-8">
            <BuildEditor build={build} />
            <TargetEditor />
            {comparedBuilds.length > 1 && <Compare builds={comparedBuilds} />}
            <Timeline builds={comparedBuilds} />
            {comparedBuilds.length > 0 && <Matrix builds={comparedBuilds} />}
            <Results build={build} />
          </div>
        ) : (
          <p className="text-neutral-600">Add a build to start.</p>
        )}
      </div>
    </main>
  );
}
