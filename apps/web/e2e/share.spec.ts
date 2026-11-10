import { expect, test } from "@playwright/test";

test("a share link opens the same comparison in another browser", async ({
  page,
  browser,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add build" }).click();
  await page.getByLabel("Build name").fill("Shared Jinx");
  await expect(page.getByTestId("ttk")).toHaveText(/^TTK /);
  const ttk = await page.getByTestId("ttk").textContent();
  await page.getByRole("button", { name: "Copy share link" }).click();
  const link = await page.getByLabel("Share link").inputValue();
  expect(link).toContain("#s=z.");

  // a fresh context has no saved work
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await theirs.goto(link);
  await expect(
    theirs.getByRole("region", { name: "Shared comparison" }),
  ).toBeVisible();
  await expect(theirs.getByLabel("Build name")).toHaveValue("Shared Jinx");
  await expect(theirs.getByTestId("ttk")).toHaveText(ttk ?? "");
  await other.close();
});
