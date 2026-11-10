/**
 * Hand corrections merged over normalized data, keyed by entity id (DATA-005).
 * Each entry says why it exists.
 */
export const valueOverrides: Record<string, Record<string, unknown>> = {
  // Guinsoo's Rageblade: League Wiki (V26.14) Phantom Hit, not in the item's values.
  "3124": { values: { PhantomStacks: 2, PhantomHitDelay: 0.15 } },
  // Essence Reaver: League Wiki (26.22) "next basic attack within 10 seconds".
  "3508": { values: { SpellbladeWindow: 10 } },
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
