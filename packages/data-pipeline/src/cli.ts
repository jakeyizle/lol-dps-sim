import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { previousPatch } from "./drift";
import { manifest } from "./manifest";
import { formatReport } from "./report";
import { PipelineError, runPipeline } from "./run";
import { fetchJson } from "./sources";

const OUT = join(import.meta.dirname, "../../data/generated");

// `pnpm data:update [patch] [--report <file>]`: the report is markdown for the data-update PR.
const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { report: { type: "string" } },
});

async function readPrevious(patch: string) {
  const available = existsSync(OUT) ? await readdir(OUT) : [];
  const previous = previousPatch(available, patch);
  if (!previous) return undefined;
  const files: Record<string, unknown> = {};
  for (const name of await readdir(join(OUT, previous)))
    if (name.endsWith(".json"))
      files[name] = JSON.parse(
        await readFile(join(OUT, previous, name), "utf8"),
      );
  return { patch: previous, files };
}

try {
  const result = await runPipeline({
    fetchJson,
    manifest,
    patch: positionals[0],
    readPrevious,
    writeFile: async (path, contents) => {
      const full = join(OUT, path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, contents);
    },
  });
  for (const w of result.warnings) console.warn(`warn: ${w}`);
  if (result.previousPatch) {
    console.log(`drift from ${result.previousPatch}:`);
    for (const line of result.drift) console.log(`  ${line}`);
    if (result.drift.length === 0) console.log("  (none)");
  }
  if (args.report) await writeFile(args.report, formatReport(result));
  console.log(
    `patch ${result.patch} (Data Dragon ${result.ddragonVersion}): ${result.champions.join(", ")}`,
  );
} catch (e) {
  console.error(e instanceof PipelineError ? e.message : e);
  process.exitCode = 1;
}
