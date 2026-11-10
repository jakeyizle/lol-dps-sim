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
  /** Stat shard rows; not in Data Dragon's rune trees. */
  shardRows: number[][];
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
  // Every rune in the five trees (runes without a modelled effect are stat-only), then stat shards.
  runes: [
    ...[8112, 8128, 9923, 8126, 8139, 8143, 8137, 8140],
    ...[8141, 8135, 8105, 8106, 8351, 8360, 8369, 8306],
    ...[8304, 8321, 8313, 8352, 8345, 8347, 8410, 8316],
    ...[8005, 8008, 8021, 8010, 9101, 9111, 8009, 9104],
    ...[9105, 9103, 8014, 8017, 8299, 8437, 8439, 8465],
    ...[8446, 8463, 8401, 8429, 8444, 8473, 8451, 8453],
    ...[8242, 8214, 8229, 8230, 8992, 8224, 8226, 8275],
    ...[8210, 8234, 8233, 8237, 8232, 8236],
    ...[5005, 5008, 5001, 5002, 5003, 5007, 5010, 5011, 5013],
  ],
  // League Wiki "Rune" (26.22): offense, flex, defense.
  shardRows: [
    [5008, 5005, 5007],
    [5008, 5010, 5001],
    [5011, 5013, 5001],
  ],
};
