import { useState } from "react";

import { encodeShare, shareUrl } from "../model/share";
import type { AppStore } from "../model/store";
import { useApp, usePatch } from "./context";

/** SAVE-003: copies a link to the current comparison (and shows it). */
export function ShareButton() {
  const patch = usePatch();
  const builds = useApp((s) => s.builds);
  const compared = useApp((s) => s.compared);
  const target = useApp((s) => s.target);
  const matrixTargets = useApp((s) => s.matrixTargets);
  const settings = useApp((s) => s.settings);
  const [link, setLink] = useState<string>();

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="rounded border px-2 py-0.5"
        onClick={() => {
          void encodeShare(
            { builds, compared, target, matrixTargets, settings },
            patch,
          ).then(async (value) => {
            const url = shareUrl(window.location.href, value);
            setLink(url);
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              // the link is shown for copying by hand
            }
          });
        }}
      >
        Copy share link
      </button>
      {link && (
        <input
          readOnly
          aria-label="Share link"
          className="w-40 rounded border px-1 text-xs"
          value={link}
          onFocus={(e) => {
            e.target.select();
          }}
        />
      )}
    </span>
  );
}

/** SAVE-007: a shared comparison is a separate view until the user keeps it. */
export function SharedBanner(props: {
  shared: AppStore;
  saved: AppStore;
  onLeave: () => void;
}) {
  const keep = () => {
    const { builds, compared, matrixTargets } = props.shared.getState();
    props.saved.setState((s) => {
      // Fresh ids so shared builds never replace saved ones.
      const ids = new Map(builds.map((b) => [b.id, crypto.randomUUID()]));
      return {
        builds: [
          ...s.builds,
          ...builds.map((b) => ({ ...b, id: ids.get(b.id) ?? b.id })),
        ],
        compared: [
          ...s.compared,
          ...compared.flatMap((id) => {
            const next = ids.get(id);
            return next ? [next] : [];
          }),
        ],
        matrixTargets: [
          ...s.matrixTargets,
          ...matrixTargets.map((t) => ({ ...t, id: crypto.randomUUID() })),
        ],
      };
    });
    props.onLeave();
  };
  return (
    <div
      role="region"
      aria-label="Shared comparison"
      className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded border border-sky-300 bg-sky-50 px-4 py-2 text-sm"
    >
      <span>
        You&apos;re viewing a shared comparison. Your saved builds are
        unchanged.
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          className="rounded border bg-white px-2"
          onClick={keep}
        >
          Save to my builds
        </button>
        <button
          type="button"
          className="rounded border bg-white px-2"
          onClick={props.onLeave}
        >
          Back to my work
        </button>
      </span>
    </div>
  );
}
