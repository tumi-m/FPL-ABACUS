import { expect, test } from "@playwright/test";

test("Field scouting charts expose distinct axes, filters and source values", async ({ page }) => {
  await page.context().addCookies([{ name: "gaffer_team", value: "1851681", url: "http://localhost:3000" }]);
  await page.goto("/field");
  await page.getByRole("link", { name: "Explore five scouting charts" }).click();
  const lab = page.getByRole("region", { name: "Five angles on the Field" });
  const views = [
    ["Attacking value", "Current price (£m)", "Expected goal involvement / 90"],
    ["Bonus conversion", "Bonus Point System score / 90", "Awarded bonus points / 90"],
    ["Defensive work", "Clearances + blocks + interceptions / 90", "Ball recoveries / 90"],
    ["Keeper trade-offs", "Expected goals conceded / 90", "Saves / 90"],
    ["Unshared returns", "Selected by FPL managers (%)", "Season FPL points / 90"],
  ];
  for (const [name, x, y] of views) {
    await lab.getByRole("button", { name, exact: true }).click();
    await expect(lab.getByRole("img")).toBeVisible();
    const description = await lab.getByRole("img").getAttribute("aria-label");
    expect(description).toContain(`X axis: ${x}. Y axis: ${y}.`);
    if (name === "Keeper trade-offs") await expect(lab.getByRole("combobox", { name: "Compare position" })).toHaveCount(0);
    await lab.getByRole("button", { name: "Show table", exact: true }).click();
    await expect(lab.getByRole("columnheader", { name: x, exact: true })).toBeVisible();
    await expect(lab.getByRole("columnheader", { name: y, exact: true })).toBeVisible();
    expect(await lab.getByRole("row").count()).toBeGreaterThan(1);
    await lab.getByRole("button", { name: "Show chart", exact: true }).click();
  }
  await lab.getByRole("combobox", { name: "Minimum minutes" }).selectOption("1800");
  await expect(lab.getByRole("status")).toContainText("No players meet this sample");
  await lab.getByRole("combobox", { name: "Minimum minutes" }).selectOption("90");
  await expect(lab.getByRole("img")).toBeVisible();
});
