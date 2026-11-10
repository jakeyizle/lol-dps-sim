import { expect, test, type Page } from "@playwright/test";

const addItem = async (page: Page, name: string) => {
  await page.getByLabel("Add item").fill(name);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
};
const seconds = (text: string | null) =>
  Number(/([\d.]+)s/.exec(text ?? "")?.[1]);

test("compare two builds side by side", async ({ page }) => {
  await page.goto("./");
  const add = page.getByRole("button", { name: "Add build" });
  await add.click();
  await add.click();
  await addItem(page, "Infinity Edge");
  const comparison = page.getByRole("region", { name: "Comparison" });
  await expect(comparison.getByRole("table")).toContainText("best");
  await expect(comparison.getByRole("list", { name: "Legend" })).toBeVisible();
  await expect(comparison.getByTestId("reference-line")).toContainText(
    "Effective health",
  );
});

test("a champion target with armor takes longer to kill", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add build" }).click();
  const ttk = page.getByTestId("ttk");
  await expect(ttk).toHaveText(/^TTK /);
  await page.getByLabel("Target kind").selectOption("champion");
  await page.getByLabel("Target champion").selectOption("Garen");
  await expect(page.getByTestId("results-target")).toHaveText(
    "vs Garen (stats only)",
  );
  const results = page.getByRole("region", { name: "Results" });
  await expect(results).toHaveAttribute("aria-busy", "false");
  const before = seconds(await ttk.textContent());
  await page.getByLabel("Add target item").selectOption({ label: "Thornmail" });
  await expect
    .poll(async () => seconds(await ttk.textContent()))
    .toBeGreaterThan(before);
});

test("the matrix compares builds against the presets", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Add build" }).click();
  await page.getByRole("button", { name: "Add presets" }).click();
  const matrix = page.getByRole("table", { name: "Matrix" });
  await expect(matrix.getByRole("columnheader")).toHaveCount(4);
  await expect(matrix.locator("td").first()).toHaveText(/\d+\.\d+s|Not killed/);
});

test("editing the rotation changes the result", async ({ page }) => {
  await page.goto("./");
  await page.locator("#new-build-champion").selectOption("Caitlyn");
  await page.getByRole("button", { name: "Add build" }).click();
  const ttk = page.getByTestId("ttk");
  await expect(ttk).toHaveText(/^TTK /);
  const before = await ttk.textContent();
  // attack only: remove W, E and Q
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Remove rule 1", exact: true })
      .click();
  await expect(page.getByText("(edited)")).toBeVisible();
  await expect(ttk).not.toHaveText(before ?? "");
});
