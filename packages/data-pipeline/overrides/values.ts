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
  // Absolute Focus: adaptive force gives 0.6 AD per AP (wiki: 1.8–18 AD or 3–30 AP).
  "8233": { values: { AdaptiveADPerAP: 0.6 } },
  // Plated Steelcaps: League Wiki (V25.04) "reduces all incoming basic damage by 10%".
  "3047": { values: { BasicDamageReduction: 0.1 } },
  // Guardian Angel: League Wiki (V25.15) revives after 4 s with 50% of base health.
  "3026": { values: { ReviveDelay: 4, ReviveBaseHealthRatio: 0.5 } },
  Ashe: {
    abilities: {
      Q: {
        // League Wiki (V26.10): "the first flurry adds a sixth arrow".
        values: { FirstFlurryShots: [6, 6, 6, 6, 6] },
      },
      // League Wiki cast times; the game file's spells list 0.
      W: { castTime: 0.25 },
      R: { castTime: 0.25 },
    },
  },
  Kaisa: {
    abilities: {
      // League Wiki: Icathian Rain has no cast time (missiles land 0.4 s later).
      Q: { castTime: 0, values: { MissileDelay: [0.4, 0.4, 0.4, 0.4, 0.4] } },
    },
  },
  Caitlyn: {
    abilities: {
      // League Wiki (V26.21) cast times; the game file's spells list 0.
      Q: { castTime: 0.625 },
      W: {
        castTime: 0.25,
        // Traps recharge 26/22/18/14/10 s (wiki, V14.17); the 0.5 s is the recast lockout.
        // The sim places one trap per recharge.
        cooldown: [26, 22, 18, 14, 10],
        values: {
          // Wiki: "arms after 1 second"; a trapped target can be headshot within 1.8 s.
          ArmDelay: [1, 1, 1, 1, 1],
          HeadshotWindow: [1.8, 1.8, 1.8, 1.8, 1.8],
        },
      },
      E: {
        castTime: 0.15,
        values: { HeadshotWindow: [1.8, 1.8, 1.8, 1.8, 1.8] },
      },
      // 0.375 s cast + 1 s channel (wiki); damage lands when the channel ends.
      R: { castTime: 1.375 },
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
