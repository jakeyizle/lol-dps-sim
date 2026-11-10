import { createStore } from "zustand/vanilla";

import { duplicateBuild, newBuild, type Build } from "./build";
import { defaultSettings, type Settings } from "./simulation";
import { defaultDummy, type Target, type TargetPreset } from "./target";

export interface MatrixTarget {
  id: string;
  name: string;
  target: Target;
}

export interface AppState {
  builds: Build[];
  /** Build ids shown in comparisons, in order. */
  compared: string[];
  target: Target;
  /** CMP-004: the matrix's targets (snapshots), in column order. */
  matrixTargets: MatrixTarget[];
  /** TGT-005: saved by the user (kept across reloads from M8, SAVE-001). */
  targetPresets: TargetPreset[];
  settings: Settings;
  addBuild: (champion: string) => Build;
  duplicateBuild: (id: string) => void;
  renameBuild: (id: string, name: string) => void;
  deleteBuild: (id: string) => void;
  updateBuild: (id: string, change: (build: Build) => Build) => void;
  /** CMP-001: include or leave out a build from the comparison. */
  toggleCompared: (id: string) => void;
  setTarget: (target: Target) => void;
  addMatrixTarget: (name: string, target: Target) => void;
  removeMatrixTarget: (id: string) => void;
  /** Saves the current target under `name`, replacing a preset of that name. */
  saveTargetPreset: (name: string) => void;
  setSettings: (settings: Partial<Settings>) => void;
  /** SAVE-004–006: messages about loaded or shared data, shown until dismissed. */
  notices: string[];
  dismissNotices: () => void;
}

/** The parts of the state that are saved (SAVE-001). */
export type SavedFields = Pick<
  AppState,
  | "builds"
  | "compared"
  | "target"
  | "matrixTargets"
  | "targetPresets"
  | "settings"
>;

export const savedFields = (s: AppState): SavedFields => ({
  builds: s.builds,
  compared: s.compared,
  target: s.target,
  matrixTargets: s.matrixTargets,
  targetPresets: s.targetPresets,
  settings: s.settings,
});

export function createAppStore(
  makeId: () => string = () => crypto.randomUUID(),
  init: { patch?: string; saved?: SavedFields; notices?: string[] } = {},
) {
  return createStore<AppState>()((set, get) => ({
    builds: [],
    compared: [],
    target: defaultDummy,
    targetPresets: [],
    matrixTargets: [],
    settings: defaultSettings,
    ...init.saved,
    notices: init.notices ?? [],
    dismissNotices: () => {
      set({ notices: [] });
    },
    addBuild: (champion) => {
      const build = { ...newBuild(makeId(), champion), patch: init.patch };
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
    toggleCompared: (id) => {
      set((s) => ({
        compared: s.compared.includes(id)
          ? s.compared.filter((c) => c !== id)
          : // keep build-list order
            s.builds
              .map((b) => b.id)
              .filter((b) => b === id || s.compared.includes(b)),
      }));
    },
    setTarget: (target) => {
      set({ target });
    },
    addMatrixTarget: (name, target) => {
      set((s) => ({
        matrixTargets: [...s.matrixTargets, { id: makeId(), name, target }],
      }));
    },
    removeMatrixTarget: (id) => {
      set((s) => ({
        matrixTargets: s.matrixTargets.filter((t) => t.id !== id),
      }));
    },
    saveTargetPreset: (name) => {
      set((s) => ({
        targetPresets: [
          ...s.targetPresets.filter((p) => p.name !== name),
          { name, target: s.target },
        ],
      }));
    },
    setSettings: (settings) => {
      set((s) => ({ settings: { ...s.settings, ...settings } }));
    },
  }));
}

export type AppStore = ReturnType<typeof createAppStore>;
