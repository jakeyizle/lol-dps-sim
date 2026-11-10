import type { PatchData } from "@lol/data";
import { createContext, useContext } from "react";
import { useStore } from "zustand";

import type { AppState, AppStore } from "../model/store";

export const StoreContext = createContext<AppStore | null>(null);
export const PatchContext = createContext<PatchData | null>(null);

export function useApp<T>(select: (state: AppState) => T): T {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useApp outside Providers");
  return useStore(store, select);
}

export function usePatch(): PatchData {
  const patch = useContext(PatchContext);
  if (!patch) throw new Error("usePatch outside Providers");
  return patch;
}
