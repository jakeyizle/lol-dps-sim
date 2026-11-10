import { declareValuePlugin, PluginKind } from "@stryker-mutator/api/plugin";

/** The bits of Babel's NodePath this ignorer reads. */
interface Path {
  node: {
    type: string;
    callee?: Node;
    key?: Node;
    arguments?: unknown[];
  };
  parentPath: Path | null;
}
interface Node {
  type: string;
  name?: string;
  object?: Node;
}

/**
 * Labels that no engine logic reads: effect and buff ids, a damage instance's `source`
 * and `onHit` flag (kept for the event log and DMG-013's wording).
 */
const LABEL_KEYS = new Set(["id", "source", "onHit"]);
/** Helpers whose last argument only names the value in an error message. */
const ERROR_LABEL_CALLS = new Set(["at"]);

const isLiteral = (type: string) =>
  type === "StringLiteral" ||
  type === "TemplateLiteral" ||
  type === "BooleanLiteral";

/**
 * PLAN §8 noise: logging, error messages (internal invariants: `throw new Error(...)` only
 * fires on broken data, so its text isn't behaviour) and labels. Renaming a label stays
 * consistent across its uses, so its mutants are equivalent.
 */
function reason(path: Path) {
  const parent = path.parentPath?.node;
  // `list ?? []`: the default for an absent optional list. Tests cover absent and present
  // lists; Stryker's ["Stryker was here"] only adds a junk element that every reader
  // skips (optional hooks and fields), so these mutants are equivalent.
  if (
    path.node.type === "ArrayExpression" &&
    (path.node as { elements?: unknown[] }).elements?.length === 0 &&
    parent?.type === "LogicalExpression" &&
    (parent as { operator?: string }).operator === "??"
  )
    return "empty default";
  if (isLiteral(path.node.type) && parent) {
    if (
      parent.type === "ObjectProperty" &&
      LABEL_KEYS.has(parent.key?.name ?? "")
    )
      return "label";
    if (
      parent.type === "CallExpression" &&
      parent.callee?.type === "Identifier" &&
      ERROR_LABEL_CALLS.has(parent.callee.name ?? "") &&
      parent.arguments?.indexOf(path.node) === 2
    )
      return "error label";
  }
  for (let p: Path | null = path; p; p = p.parentPath) {
    const { node } = p;
    if (node.type !== "CallExpression" && node.type !== "NewExpression")
      continue;
    const c = node.callee;
    const callee = c?.type === "MemberExpression" ? c.object?.name : c?.name;
    if (callee === "console") return "logging";
    if (
      node.type === "NewExpression" &&
      (callee === "Error" || callee === "RangeError")
    )
      return "error message";
  }
  return undefined;
}

export const strykerPlugins = [
  declareValuePlugin(PluginKind.Ignore, "noise", {
    shouldIgnore: (path) => reason(path as Path),
  }),
];
