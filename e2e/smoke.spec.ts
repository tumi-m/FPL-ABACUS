import { expect, test } from "@playwright/test";

test("landing renders wordmark and tagline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("GAFFER")).toBeVisible();
  await expect(page.getByText("Your gameweek, explained.")).toBeVisible();
});
