export interface ChampionEntry {
  /** Data Dragon id, e.g. `Kaisa`. */
  id: string;
  /** CommunityDragon character folder, e.g. `kaisa`. */
  gameName: string;
}

export interface Manifest {
  champions: ChampionEntry[];
  /** Item ids. */
  items: string[];
  /** Rune and stat shard ids. */
  runes: number[];
}

export const manifest: Manifest = {
  champions: [
    { id: "Jinx", gameName: "jinx" },
    { id: "Caitlyn", gameName: "caitlyn" },
    { id: "Ashe", gameName: "ashe" },
    { id: "Kaisa", gameName: "kaisa" },
    { id: "Vayne", gameName: "vayne" },
  ],
  // MVP ADC items (scenarios/items.md, PLAN §2), then target defensive items (scenarios/target.md).
  items: [
    ...["3031", "3036", "3033", "6672", "3153", "3085", "3046", "3094"],
    ...["3087", "6675", "3072", "3508", "6676", "3302", "3124", "3115"],
    ...["3091", "6673", "3156", "3053", "1055", "3006"],
    ...["3032", "2512", "3095", "2523"],
    ...["3143", "3047", "3026", "3157", "3110", "3075", "3065", "2501"],
  ],
  // Keystones, minor runes (scenarios/runes.md), then stat shards.
  runes: [
    ...[8008, 8005, 9923, 8010, 8021, 8014, 8017, 8299, 9104, 9103],
    ...[8236, 8233],
    ...[5005, 5008, 5001, 5002, 5003, 5007, 5010, 5011, 5013],
  ],
};
