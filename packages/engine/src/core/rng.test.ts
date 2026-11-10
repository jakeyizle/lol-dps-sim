import { expect, it } from "vitest";

import { seededRandom } from "./rng";

it(
  "is mulberry32: seed 1 gives the reference sequence",
  { tags: ["SIM-012"] },
  () => {
    const r = seededRandom(1);
    expect([r(), r(), r()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  },
);
