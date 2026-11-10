/**
 * Hand corrections merged over normalized data, keyed by entity id (DATA-005).
 * Each entry says why it exists.
 */
export const valueOverrides: Record<string, Record<string, unknown>> = {
  // Guinsoo's Rageblade: League Wiki (V26.14) Phantom Hit, not in the item's values.
  "3124": { values: { PhantomStacks: 2, PhantomHitDelay: 0.15 } },
  // Essence Reaver: League Wiki (26.22) "next basic attack within 10 seconds".
  "3508": { values: { SpellbladeWindow: 10 } },
  // Lethal Tempo: League Wiki (V25.23) "remaining stacks expire one at a time, every 0.3 seconds".
  "8008": { values: { DecayInterval: 0.3 } },
  // Conqueror: League Wiki (V14.24) 2 stacks per melee attack, 1 ranged, 2 per ability;
  // adaptive force gives 0.6 AD per AP (same ratio as the adaptive shard's StatGain1/2).
  "8010": {
    values: {
      StacksPerAttackMelee: 2,
      StacksPerAttackRanged: 1,
      StacksPerAbility: 2,
      AdaptiveADPerAP: 0.6,
    },
  },
  Jinx: {
    abilities: {
      Q: {
        // Switcheroo! is an instant toggle; the spell's 0.25 cast time is unused.
        castTime: 0,
        values: {
          // Wiki 26.22: "the first stack being twice as potent"; not in the game file.
          MinigunFirstStackWeight: [2, 2, 2, 2, 2],
        },
      },
      W: {
        // The 0.6 s cast lives on JinxWMissile; JinxW's 0.25 is a placeholder.
        castTime: 0.6,
      },
    },
  },
};
