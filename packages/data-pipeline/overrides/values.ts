/**
 * Hand corrections merged over normalized data, keyed by entity id (DATA-005).
 * Each entry says why it exists.
 */
export const valueOverrides: Record<string, Record<string, unknown>> = {
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
