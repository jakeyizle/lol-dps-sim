import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { manifest } from "./manifest";
import { PipelineError, runPipeline } from "./run";
import { fetchJson } from "./sources";

const OUT = join(import.meta.dirname, "../../data/generated");

try {
  const result = await runPipeline({
    fetchJson,
    manifest,
    patch: process.argv[2],
    writeFile: async (path, contents) => {
      const full = join(OUT, path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, contents);
    },
  });
  for (const w of result.warnings) console.warn(`warn: ${w}`);
  console.log(
    `patch ${result.patch} (Data Dragon ${result.ddragonVersion}): ${result.champions.join(", ")}`,
  );
} catch (e) {
  console.error(e instanceof PipelineError ? e.message : e);
  process.exitCode = 1;
}
