import { ddragonVersionsUrl, type FetchJson } from "./sources";

export interface ResolvedPatch {
  /** Full Data Dragon version, e.g. `16.22.1`. */
  ddragonVersion: string;
  /** Game version `<major>.<minor>`, e.g. `16.22`: CommunityDragon paths. */
  gamePatch: string;
  /** Public patch, e.g. `26.22`: folder names, files and the app (DATA-021). */
  patch: string;
}

/** Riot names patches by year (26.x) while data sources keep the game version (16.x). */
const PUBLIC_OFFSET = 10;

const toGamePatch = (version: string) =>
  version.split(".").slice(0, 2).join(".");

export function toPublicPatch(gamePatch: string) {
  const [major = "", minor = ""] = gamePatch.split(".");
  return `${String(Number(major) + PUBLIC_OFFSET)}.${minor}`;
}

/** Newest Data Dragon version, or the newest one for the requested public patch. */
export async function resolvePatch(
  fetchJson: FetchJson,
  requested?: string,
): Promise<ResolvedPatch> {
  const versions = await fetchJson(ddragonVersionsUrl());
  if (!Array.isArray(versions) || !versions.every((v) => typeof v === "string"))
    throw new Error("Data Dragon version list is not a list of strings");

  const version = requested
    ? versions.find((v) => toPublicPatch(toGamePatch(v)) === requested)
    : versions[0];
  if (!version)
    throw new Error(
      requested
        ? `Data Dragon has no version for patch ${requested}`
        : "Data Dragon version list is empty",
    );
  const gamePatch = toGamePatch(version);
  return {
    ddragonVersion: version,
    gamePatch,
    patch: toPublicPatch(gamePatch),
  };
}
