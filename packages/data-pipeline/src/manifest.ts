export interface ChampionEntry {
  /** Data Dragon id, e.g. `Kaisa`. */
  id: string;
  /** CommunityDragon character folder, e.g. `kaisa`. */
  gameName: string;
}

export interface Manifest {
  champions: ChampionEntry[];
}

export const manifest: Manifest = {
  champions: [
    { id: "Jinx", gameName: "jinx" },
    { id: "Caitlyn", gameName: "caitlyn" },
    { id: "Ashe", gameName: "ashe" },
    { id: "Kaisa", gameName: "kaisa" },
    { id: "Vayne", gameName: "vayne" },
  ],
};
