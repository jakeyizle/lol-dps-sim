import { describe, expect, it } from "vitest";

import { skillOrders } from "../overrides/skill-orders";
import { manifest } from "./manifest";
import { expandSkillOrder } from "./skill-order";

describe("skill orders", { tags: ["DATA-016"] }, () => {
  it("expand to the standard max order", () => {
    expect(
      expandSkillOrder({ start: ["Q", "W", "E"], max: ["Q", "W", "E"] }).join(
        " ",
      ),
    ).toBe("Q W E Q Q R Q W Q W R W W E E R E E");
  });

  it("respect rank level requirements (rank n needs level 2n − 1)", () => {
    // Ashe maxes W but level 2 can't take W rank 2
    expect(
      expandSkillOrder({ start: ["W", "Q", "E"], max: ["W", "Q", "E"] })
        .slice(0, 7)
        .join(" "),
    ).toBe("W Q E W W R W");
  });

  it("give every basic ability 5 ranks and R 3", () => {
    const order = expandSkillOrder({
      start: ["Q", "W", "E"],
      max: ["Q", "E", "W"],
    });
    const count = (k: string) => order.filter((a) => a === k).length;
    expect([count("Q"), count("W"), count("E"), count("R")]).toEqual([
      5, 5, 5, 3,
    ]);
  });

  it("exist for every manifest champion", () => {
    for (const { id } of manifest.champions)
      expect(skillOrders[id]).toBeDefined();
  });
});
