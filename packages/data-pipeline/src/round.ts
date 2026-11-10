/** Removes float32 noise from game values (DATA-014). */
export const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
