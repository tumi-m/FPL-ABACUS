import { expect, test } from "@playwright/test";

test("landing renders wordmark and the gate", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Gaffer/);
  await expect(page.getByRole("img", { name: /troph/i })).toBeVisible();
  await expect(page.getByLabel("Your FPL team ID")).toBeVisible();
});
