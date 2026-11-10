/** Game-wide rules no game file gives us (DATA-015). Each value names its source. */
export const constants = {
  /** League Wiki "Attack speed" (V25.10): "precisely 3.003". Verify in Practice Tool. */
  attackSpeedCap: 3.003,
  /** Patch 26.1 notes; matches `critDamageMultiplier` in patch 26.22 champion files. */
  baseCritMultiplier: 2,
};
