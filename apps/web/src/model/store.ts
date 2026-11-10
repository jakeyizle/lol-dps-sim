import { createStore } from "zustand/vanilla";

import { duplicateBuild, newBuild, type Build } from "./build";
import {
  defaultDummy,
  defaultSettings,
  type DummyTarget,
  type Settings,
} from "./simulation";

export interface AppState {
  builds: Build[];
  /** Build ids shown in comparisons, in order. */
  compared: string[];
  target: DummyTarget;
  settings: Settings;
  addBuild: (champion: string) => Build;
  duplicateBuild: (id: string) => void;
  renameBuild: (id: string, name: string) => void;
  deleteBuild: (id: string) => void;
  updateBuild: (id: string, change: (build: Build) => Build) => void;
  setTarget: (target: DummyTarget) => void;
  setSettings: (settings: Partial<Settings>) => void;
}

export function createAppStore(
  makeId: () => string = () => crypto.randomUUID(),
) {
  return createStore<AppState>()((set, get) => ({
    builds: [],
    compared: [],
    target: defaultDummy,
    settings: defaultSettings,
    addBuild: (champion) => {
      const build = newBuild(makeId(), champion);
      set((s) => ({
        builds: [...s.builds, build],
        compared: [...s.compared, build.id],
      }));
      return build;
    },
    duplicateBuild: (id) => {
      const source = get().builds.find((b) => b.id === id);
      if (!source) return;
      const copy = duplicateBuild(source, makeId());
      set((s) => ({
        builds: [...s.builds, copy],
        compared: [...s.compared, copy.id],
      }));
    },
    renameBuild: (id, name) => {
      get().updateBuild(id, (b) => ({ ...b, name }));
    },
    // BUILD-011: gone from the list and every comparison.
    deleteBuild: (id) => {
      set((s) => ({
        builds: s.builds.filter((b) => b.id !== id),
        compared: s.compared.filter((c) => c !== id),
      }));
    },
    updateBuild: (id, change) => {
      set((s) => ({
        builds: s.builds.map((b) => (b.id === id ? change(b) : b)),
      }));
    },
    setTarget: (target) => {
      set({ target });
    },
    setSettings: (settings) => {
      set((s) => ({ settings: { ...s.settings, ...settings } }));
    },
  }));
}

export type AppStore = ReturnType<typeof createAppStore>;
