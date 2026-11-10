import type { PatchData } from "@lol/data";
import type { ReactNode } from "react";

import type { AppStore } from "../model/store";
import { PatchContext, StoreContext } from "./context";

export function Providers(props: {
  store: AppStore;
  patch: PatchData;
  children: ReactNode;
}) {
  return (
    <StoreContext.Provider value={props.store}>
      <PatchContext.Provider value={props.patch}>
        {props.children}
      </PatchContext.Provider>
    </StoreContext.Provider>
  );
}
