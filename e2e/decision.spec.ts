import { expect, test } from "@playwright/test";

test("decision room compares a staged move, changes assumptions and resets", async ({ page }) => {
  await page.context().addCookies([{ name: "gaffer_team", value: "1851681", url: "http://localhost:3000" }]);
  await page.goto("/planner");
  const room = page.getByRole("region", { name: "Decision room" });
  await expect(room).toHaveCount(0);
  await page.getByRole("group", { name: "Your squad on the pitch" }).getByRole("button", { name: /Midfielder/ }).first().click();
  const market = page.getByRole("region", { name: "Player market" });
  await market.locator("tbody tr button:not([disabled])").first().click();
  await page.getByRole("link", { name: "Compare paths" }).click();
  await expect(room).toBeVisible();
  await expect(room.getByText("Leads this scenario", { exact: true })).toHaveCount(1);
  const baseline = await room.getByRole("img").getAttribute("aria-label");
  const slider = room.getByRole("slider", { name: "What if the arrivals deliver less?" });
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("50");
  await expect(room.getByRole("img")).not.toHaveAttribute("aria-label", baseline!);
  await room.getByRole("button", { name: "Reset to model" }).click();
  await expect(slider).toHaveValue("100");
  await expect(room.getByRole("img")).toHaveAttribute("aria-label", baseline!);
  await room.getByRole("button", { name: "Show table" }).click();
  await expect(room.getByRole("table")).toBeVisible();
  await expect(room.getByRole("row")).toHaveCount(4);
  await room.getByRole("button", { name: "1 GW", exact: true }).click();
  await expect(room.getByText("Needs at least two gameweeks")).toBeVisible();
  await expect(room.getByRole("row")).toHaveCount(2);
  await page.reload();
  await expect(room).toBeVisible();
  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await expect(room).toHaveCount(0);
});

test("navigation fits narrow screens and exposes secondary tools", async ({ page }) => {
  await page.context().addCookies([{ name: "gaffer_team", value: "1851681", url: "http://localhost:3000" }]);
  await page.goto("/planner");
  for (const width of [375, 640, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await page.locator("header").first().evaluate((el) => ({
      width: el.clientWidth,
      right: Math.max(...Array.from(el.querySelectorAll("a,button,summary")).filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.getBoundingClientRect().right)),
    }));
    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
    expect(await page.locator("body").evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.locator("summary").filter({ hasText: /^More/ }).click();
  await expect(page.getByRole("navigation", { name: "Explore GAFFER" })).toBeVisible();
  await page.locator("summary").filter({ hasText: /^More/ }).press("Escape");
  await expect(page.getByRole("navigation", { name: "Explore GAFFER" })).toBeHidden();
  await page.locator("summary").filter({ hasText: /^More/ }).click();
  await page.getByRole("navigation", { name: "Explore GAFFER" }).getByRole("link", { name: "Manager DNA" }).click();
  await expect(page).toHaveURL(/\/dna$/);
});
