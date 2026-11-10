import { expect, test } from "@playwright/test";

test("builds survive a reload", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add build" }).click();
  await page.getByLabel("Add item").fill("Infinity Edge");
  await expect(page.getByText("Infinity Edge", { exact: true })).toBeVisible();
  // saving waits for edits to settle
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByLabel("Build name")).toHaveValue("Jinx");
  await expect(page.getByText("Infinity Edge", { exact: true })).toBeVisible();
});
