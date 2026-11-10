import type { DummyTarget } from "../model/simulation";
import { useApp } from "./context";

/** TGT-002: a custom dummy with entered stats. */
export function TargetEditor() {
  const target = useApp((s) => s.target);
  const setTarget = useApp((s) => s.setTarget);
  const field = (
    key: "health" | "armor" | "magicResist",
    label: string,
    min: number,
  ) => (
    <label className="flex items-center gap-2">
      {label}
      <input
        type="number"
        className="w-24 rounded border px-1"
        min={min}
        value={target[key]}
        onChange={(e) => {
          const next: DummyTarget = {
            ...target,
            [key]: Math.max(min, Number(e.target.value)),
          };
          setTarget(next);
        }}
      />
    </label>
  );
  return (
    <fieldset aria-label="Target" className="flex flex-wrap gap-4">
      <legend className="font-medium">Target dummy</legend>
      {field("health", "Health", 1)}
      {field("armor", "Armor", -200)}
      {field("magicResist", "Magic resist", -200)}
    </fieldset>
  );
}
