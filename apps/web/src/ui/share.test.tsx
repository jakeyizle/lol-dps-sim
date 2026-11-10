import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../App";
import { loadLatest } from "../data";
import { newBuild, withItem, type Build } from "../model/build";
import { decodeShare, encodeShare, type SharedFields } from "../model/share";
import { defaultSettings } from "../model/simulation";
import { createAppStore } from "../model/store";
import { defaultDummy } from "../model/target";
import { inlineRunner } from "../worker/runner";

afterEach(cleanup);

const patch = loadLatest();

const withIE = (b: Build) => {
  const r = withItem(b, "3031", patch.items);
  return r.ok ? r.build : b;
};
const sharedState: SharedFields = {
  builds: [
    { ...withIE(newBuild("s1", "Caitlyn", "Shared Cait")), patch: patch.patch },
  ],
  compared: ["s1"],
  target: { ...defaultDummy, armor: 120 },
  matrixTargets: [],
  settings: { ...defaultSettings, gameTime: 22 },
};

function open(hash: string, savedBuilds: Build[] = []) {
  const saved = createAppStore(undefined, {
    saved: {
      builds: savedBuilds,
      compared: savedBuilds.map((b) => b.id),
      target: defaultDummy,
      matrixTargets: [],
      targetPresets: [],
      settings: defaultSettings,
    },
  });
  render(
    <App
      store={saved}
      patch={patch}
      runner={inlineRunner(patch)}
      debounceMs={0}
      hash={hash}
    />,
  );
  return saved;
}
const buildNames = () =>
  within(screen.getByRole("region", { name: "Builds" }))
    .getAllByLabelText("Build name")
    .map((i) => (i as HTMLInputElement).value);

describe("share links", () => {
  it(
    "round-trip the comparison, which shows with the same results",
    { tags: ["SAVE-003"] },
    async () => {
      const value = await encodeShare(sharedState, patch);
      const back = await decodeShare(value, patch);
      expect(back.ok && back.state).toEqual({
        ...sharedState,
        targetPresets: [],
      });

      open(`#s=${value}`);
      await waitFor(() => {
        expect(buildNames()).toEqual(["Shared Cait"]);
      });
      // the same results as the sender's
      const source = createAppStore(undefined, {
        saved: { ...sharedState, targetPresets: [] },
      });
      cleanup();
      render(
        <App
          store={source}
          patch={patch}
          runner={inlineRunner(patch)}
          debounceMs={0}
          hash=""
        />,
      );
      const ttk = await screen.findByTestId("ttk");
      const expected = ttk.textContent;
      cleanup();
      open(`#s=${value}`);
      await waitFor(() => {
        expect(screen.getByTestId("ttk").textContent).toBe(expected);
      });
    },
  );

  it(
    "a broken or tampered link shows an error and keeps saved work",
    { tags: ["SAVE-004"] },
    async () => {
      const mine = newBuild("m1", "Jinx", "My Jinx");
      const value = await encodeShare(sharedState, patch);
      const tampered = value.slice(0, 10) + "AAAA" + value.slice(14);
      for (const hash of ["#s=nonsense", `#s=${tampered}`, "#s=j.e30"]) {
        const saved = open(hash, [mine]);
        await waitFor(() => {
          expect(
            screen.getByRole("status", { name: "Notices" }).textContent,
          ).toMatch(/This share link is broken\./);
        });
        expect(buildNames()).toEqual(["My Jinx"]);
        expect(saved.getState().builds).toEqual([mine]);
        cleanup();
      }
    },
  );

  it(
    "open beside saved work, which stays available and can take the shared builds",
    { tags: ["SAVE-007"] },
    async () => {
      const mine = newBuild("m1", "Jinx", "My Jinx");
      const value = await encodeShare(sharedState, patch);
      const saved = open(`#s=${value}`, [mine]);
      await screen.findByRole("region", { name: "Shared comparison" });
      expect(buildNames()).toEqual(["Shared Cait"]);
      expect(saved.getState().builds).toEqual([mine]);

      fireEvent.click(screen.getByRole("button", { name: "Back to my work" }));
      expect(buildNames()).toEqual(["My Jinx"]);
      cleanup();

      const again = open(`#s=${value}`, [mine]);
      await screen.findByRole("region", { name: "Shared comparison" });
      fireEvent.click(
        screen.getByRole("button", { name: "Save to my builds" }),
      );
      expect(buildNames()).toEqual(["My Jinx", "Shared Cait"]);
      const ids = again.getState().builds.map((b) => b.id);
      expect(new Set(ids).size).toBe(2);
      expect(again.getState().compared).toHaveLength(2);
    },
  );
});
