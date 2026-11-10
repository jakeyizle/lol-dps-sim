/** Markdown body for the data-update PR (PLAN §9). */
export function formatReport(result: {
  patch: string;
  ddragonVersion: string;
  previousPatch?: string;
  drift: readonly string[];
  warnings: readonly string[];
}) {
  const lines = [
    `Patch ${result.patch} (game version ${result.ddragonVersion}).`,
    "",
    result.previousPatch
      ? `### Changes from ${result.previousPatch}`
      : "### Changes",
    "",
  ];
  if (!result.previousPatch) lines.push("No earlier patch to compare with.");
  else if (result.drift.length === 0) lines.push("None.");
  else lines.push("```", ...result.drift, "```");
  if (result.warnings.length)
    lines.push(
      "",
      "### Source disagreements",
      "",
      ...result.warnings.map((w) => `- ${w}`),
    );
  return `${lines.join("\n")}\n`;
}
