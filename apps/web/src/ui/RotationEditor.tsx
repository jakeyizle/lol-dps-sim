import type { Condition, Rotation, Rule } from "@lol/engine";

import {
  addedRule,
  CONDITION_KINDS,
  movedRule,
  newCondition,
  withoutRule,
  withRule,
} from "../model/rotation";

const ACTION_LABELS: Record<string, string> = { attack: "Auto attack" };
const small = "rounded border px-1 text-sm";

/**
 * ROT-008–010: the build's rule list in priority order. Actions are the kit's abilities
 * and "attack"; "min stacks" names one of the kit's stack buffs.
 */
export function RotationEditor(props: {
  rotation: Rotation;
  /** True while the build uses the champion's default. */
  isDefault: boolean;
  actions: readonly string[];
  buffs: readonly { id: string; label: string; max: number }[];
  onChange: (rotation: Rotation) => void;
  onReset: () => void;
}) {
  const { rotation, actions, buffs, onChange } = props;
  const label = (a: string) => ACTION_LABELS[a] ?? a;
  const kinds = CONDITION_KINDS.filter(
    (k) => k.kind !== "minStacks" || buffs.length > 0,
  );

  const conditionFields = (
    rule: Rule,
    index: number,
    c: Condition,
    ci: number,
  ) => {
    const set = (next: Condition) => {
      const when = (rule.when ?? []).map((x, i) => (i === ci ? next : x));
      onChange(withRule(rotation, index, { ...rule, when }));
    };
    const prefix = `Rule ${String(index + 1)} condition ${String(ci + 1)}`;
    switch (c.kind) {
      case "targetHealthBelow":
        return (
          <input
            type="number"
            aria-label={`${prefix} health %`}
            className={`w-16 ${small}`}
            min={1}
            max={100}
            value={Math.round(c.fraction * 100)}
            onChange={(e) => {
              set({
                ...c,
                fraction:
                  Math.max(1, Math.min(100, Number(e.target.value))) / 100,
              });
            }}
          />
        );
      case "minMana":
        return (
          <input
            type="number"
            aria-label={`${prefix} mana`}
            className={`w-20 ${small}`}
            min={0}
            value={c.amount}
            onChange={(e) => {
              set({ ...c, amount: Math.max(0, Number(e.target.value)) });
            }}
          />
        );
      case "minStacks":
        return (
          <>
            <input
              type="number"
              aria-label={`${prefix} stacks`}
              className={`w-14 ${small}`}
              min={1}
              value={c.stacks}
              onChange={(e) => {
                set({ ...c, stacks: Math.max(1, Number(e.target.value)) });
              }}
            />
            <select
              aria-label={`${prefix} buff`}
              className={small}
              value={c.buff}
              onChange={(e) => {
                set({ ...c, buff: e.target.value });
              }}
            >
              {buffs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">
        Rotation{" "}
        <span className="text-sm font-normal text-neutral-600">
          {props.isDefault ? "(default)" : "(edited)"}
        </span>
      </legend>
      <ol className="space-y-1">
        {rotation.map((rule, index) => (
          <li
            key={index}
            className="flex flex-wrap items-center gap-2 text-sm"
            data-rule={index}
          >
            <span className="w-5 text-neutral-600">{index + 1}.</span>
            <select
              aria-label={`Rule ${String(index + 1)} action`}
              className={small}
              value={rule.action}
              onChange={(e) => {
                onChange(
                  withRule(rotation, index, {
                    ...rule,
                    action: e.target.value,
                  }),
                );
              }}
            >
              {actions.map((a) => (
                <option key={a} value={a}>
                  {label(a)}
                </option>
              ))}
            </select>
            {(rule.when ?? []).map((c, ci) => (
              <span
                key={ci}
                className="flex items-center gap-1 rounded bg-neutral-100 px-1"
              >
                {CONDITION_KINDS.find((k) => k.kind === c.kind)?.label}
                {conditionFields(rule, index, c, ci)}
                <button
                  type="button"
                  aria-label={`Remove rule ${String(index + 1)} condition ${String(ci + 1)}`}
                  className="text-neutral-500"
                  onClick={() => {
                    const when = (rule.when ?? []).filter((_, i) => i !== ci);
                    onChange(withRule(rotation, index, { ...rule, when }));
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <select
              aria-label={`Rule ${String(index + 1)} add condition`}
              className={`w-28 ${small}`}
              value=""
              onChange={(e) => {
                const kind = kinds.find((k) => k.kind === e.target.value)?.kind;
                const c = kind && newCondition(kind, buffs[0]);
                if (!c) return;
                onChange(
                  withRule(rotation, index, {
                    ...rule,
                    when: [...(rule.when ?? []), c],
                  }),
                );
              }}
            >
              <option value="">+ condition</option>
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Move rule ${String(index + 1)} up`}
              className={small}
              disabled={index === 0}
              onClick={() => {
                onChange(movedRule(rotation, index, index - 1));
              }}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move rule ${String(index + 1)} down`}
              className={small}
              disabled={index === rotation.length - 1}
              onClick={() => {
                onChange(movedRule(rotation, index, index + 1));
              }}
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`Remove rule ${String(index + 1)}`}
              className={small}
              onClick={() => {
                onChange(withoutRule(rotation, index));
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <button
          type="button"
          className={small}
          onClick={() => {
            onChange(addedRule(rotation, { action: actions[0] ?? "attack" }));
          }}
        >
          Add rule
        </button>
        <button
          type="button"
          className={small}
          disabled={props.isDefault}
          onClick={props.onReset}
        >
          Reset to default
        </button>
      </div>
    </fieldset>
  );
}
