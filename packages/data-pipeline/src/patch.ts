import { ddragonVersionsUrl, type FetchJson } from "./sources";

export interface ResolvedPatch {
  /** Full Data Dragon version, e.g. `16.22.1`. */
  ddragonVersion: string;
  /** `<major>.<minor>`, e.g. `16.22`: folder names and CommunityDragon paths. */
  patch: string;
}

const toPatch = (version: string) => version.split(".").slice(0, 2).join(".");

/** Newest Data Dragon version, or the newest one for the requested patch. */
export async function resolvePatch(
  fetchJson: FetchJson,
  requested?: string,
): Promise<ResolvedPatch> {
  const versions = await fetchJson(ddragonVersionsUrl());
  if (!Array.isArray(versions) || !versions.every((v) => typeof v === "string"))
    throw new Error("Data Dragon version list is not a list of strings");

  const version = requested
    ? versions.find((v) => toPatch(v) === requested)
    : versions[0];
  if (!version)
    throw new Error(
      requested
        ? `Data Dragon has no version for patch ${requested}`
        : "Data Dragon version list is empty",
    );
  return { ddragonVersion: version, patch: toPatch(version) };
}
