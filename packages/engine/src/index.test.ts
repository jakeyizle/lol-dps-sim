import { expect, test } from "vitest";

import { ENGINE_VERSION } from "./index";

test("engine module loads", () => {
  expect(ENGINE_VERSION).toBe(1);
});
