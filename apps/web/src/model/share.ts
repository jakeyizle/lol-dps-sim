import type { PatchData } from "@lol/data";

import { restore, serialize, type Restored } from "./persist";
import type { SavedFields } from "./store";

/** `#s=<data>`: the shared comparison lives in the URL hash, never on a server. */
export const SHARE_PARAM = "s";

/** What a link carries: the comparison, not the user's presets. */
export type SharedFields = Omit<SavedFields, "targetPresets">;

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
  // Stryker disable next-line Regex,StringLiteral: base64 only pads at the end, and atob accepts it either way
  return b64.replace(/=+$/, "");
};
// atob is forgiving base64: missing padding is fine.
const fromBase64Url = (text: string) => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: GenericTransformStream) {
  const body = new Response(new Uint8Array(bytes)).body;
  // Stryker disable next-line all: a Response built from bytes always has a body
  if (!body) throw new Error("no stream");
  const out = body.pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const canCompress = () =>
  typeof CompressionStream !== "undefined" &&
  typeof DecompressionStream !== "undefined";

/**
 * SAVE-003: the hash value for `state`: the save format (versioned, with item names),
 * deflated when the browser can ("z." prefix), else plain ("j.").
 */
export async function encodeShare(
  state: SharedFields,
  patch: PatchData,
): Promise<string> {
  const json = serialize({ ...state, targetPresets: [] }, patch);
  const bytes = new TextEncoder().encode(json);
  return canCompress()
    ? `z.${toBase64Url(await pipe(bytes, new CompressionStream("deflate-raw")))}`
    : `j.${toBase64Url(bytes)}`;
}

/** SAVE-003, SAVE-004: the shared state, or an error for a malformed or tampered link. */
export async function decodeShare(
  value: string,
  patch: PatchData,
): Promise<Restored> {
  const bad: Restored = { ok: false, error: "This share link is broken." };
  try {
    const kind = value.slice(0, 2);
    const data = value.slice(2);
    let bytes: Uint8Array;
    if (kind === "z." && canCompress())
      bytes = await pipe(
        fromBase64Url(data),
        new DecompressionStream("deflate-raw"),
      );
    else if (kind === "j.") bytes = fromBase64Url(data);
    else return bad;
    const restored = restore(new TextDecoder().decode(bytes), patch);
    return restored.ok ? restored : bad;
  } catch {
    return bad;
  }
}

/** The share value in a location hash, if any. */
export function shareFromHash(hash: string): string | undefined {
  // Stryker disable next-line Regex: a share value is base64url, which never contains #
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get(SHARE_PARAM) ?? undefined;
}

/** A link to `value` from `href` (keeping path and query, replacing the hash). */
export function shareUrl(href: string, value: string) {
  const url = new URL(href);
  url.hash = `${SHARE_PARAM}=${value}`;
  return url.toString();
}
