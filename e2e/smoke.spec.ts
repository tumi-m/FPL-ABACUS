import { expect, test } from "@playwright/test";

test("landing renders wordmark and tagline", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Gaffer/);
  await expect(page.getByText("Your gameweek, explained.")).toBeVisible();
});
