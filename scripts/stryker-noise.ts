import { declareValuePlugin, PluginKind } from "@stryker-mutator/api/plugin";

/** The bits of Babel's NodePath this ignorer reads. */
interface Path {
  node: { type: string; callee?: Node };
  parentPath: Path | null;
}
interface Node {
  type: string;
  name?: string;
  object?: Node;
}

/**
 * PLAN §8 noise: logging and error-message strings (internal invariants: `throw new
 * Error(...)` only fires on broken data, so its text isn't behaviour).
 */
function reason(path: Path) {
  for (let p: Path | null = path; p; p = p.parentPath) {
    const { node } = p;
    if (node.type !== "CallExpression" && node.type !== "NewExpression")
      continue;
    const c = node.callee;
    const callee = c?.type === "MemberExpression" ? c.object?.name : c?.name;
    if (callee === "console") return "logging";
    if (node.type === "NewExpression" && callee === "Error")
      return "error message";
  }
  return undefined;
}

export const strykerPlugins = [
  declareValuePlugin(PluginKind.Ignore, "noise", {
    shouldIgnore: (path) => reason(path as Path),
  }),
];
