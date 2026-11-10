export type FetchJson = (url: string) => Promise<unknown>;

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`GET ${url} failed: ${String(status)}`);
  }
}

export const fetchJson: FetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(url, res.status);
  return res.json();
};

const DDRAGON = "https://ddragon.leagueoflegends.com";
const CDRAGON = "https://raw.communitydragon.org";

export const ddragonVersionsUrl = () => `${DDRAGON}/api/versions.json`;

/** Every champion's summary, including base stats. */
export const ddragonChampionListUrl = (version: string) =>
  `${DDRAGON}/cdn/${version}/data/en_US/champion.json`;

export const ddragonChampionUrl = (version: string, id: string) =>
  `${DDRAGON}/cdn/${version}/data/en_US/champion/${id}.json`;

/** Always the patch's own folder, never `latest` (DATA-010). */
export const cdragonCharacterUrl = (patch: string, name: string) =>
  `${CDRAGON}/${patch}/game/data/characters/${name}/${name}.bin.json`;

export const ddragonItemsUrl = (version: string) =>
  `${DDRAGON}/cdn/${version}/data/en_US/item.json`;

export const ddragonRunesUrl = (version: string) =>
  `${DDRAGON}/cdn/${version}/data/en_US/runesReforged.json`;

export const cdragonItemsUrl = (patch: string) =>
  `${CDRAGON}/${patch}/game/items.cdtb.bin.json`;

export const cdragonPerksUrl = (patch: string) =>
  `${CDRAGON}/${patch}/game/perks.cdtb.bin.json`;

/** Display names for runes, including stat shards (Data Dragon lacks shards). */
export const cdragonPerkNamesUrl = (patch: string) =>
  `${CDRAGON}/${patch}/plugins/rcp-be-lol-game-data/global/default/v1/perks.json`;
