import { expect, test } from "@playwright/test";

test("a Jinx build's TTK drops when an item is added", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add build" }).click();
  const ttk = page.getByTestId("ttk");
  await expect(ttk).toHaveText(/^TTK \d+\.\d+s$/);
  const seconds = async () =>
    Number(/([\d.]+)s/.exec((await ttk.textContent()) ?? "")?.[1]);
  const before = await seconds();

  await page.getByLabel("Add item").fill("Infinity Edge");
  await expect(page.getByText("Infinity Edge", { exact: true })).toBeVisible();
  await expect.poll(seconds).toBeLessThan(before);
});
