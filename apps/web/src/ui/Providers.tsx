import type { PatchData } from "@lol/data";
import type { ReactNode } from "react";

import type { AppStore } from "../model/store";
import type { Runner } from "../worker/runner";
import { PatchContext, StoreContext } from "./context";
import { RunnerContext } from "./useAnalysis";

export function Providers(props: {
  store: AppStore;
  patch: PatchData;
  runner: { runner: Runner; debounceMs: number };
  children: ReactNode;
}) {
  return (
    <StoreContext.Provider value={props.store}>
      <PatchContext.Provider value={props.patch}>
        <RunnerContext.Provider value={props.runner}>
          {props.children}
        </RunnerContext.Provider>
      </PatchContext.Provider>
    </StoreContext.Provider>
  );
}
