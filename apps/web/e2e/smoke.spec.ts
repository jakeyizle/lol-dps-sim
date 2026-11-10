import { expect, test } from "@playwright/test";

test("the app loads and shows the data patch", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText(/^Patch \d+\.\d+$/)).toBeVisible();
});
