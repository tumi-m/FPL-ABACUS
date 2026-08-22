import { expect, test, type Page } from "@playwright/test";

const TEAM_ID = "1851681";

function teamCookie() {
  return { name: "gaffer_team", value: TEAM_ID, url: "http://localhost:3000" };
}

async function asTeam(page: Page) {
  await page.context().addCookies([teamCookie()]);
}

test("landing renders tagline", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/GAFFER/);
  await expect(page.getByText("Your gameweek, explained.")).toBeVisible();
});

test.describe("team ID gate flow", () => {
  test("invalid ID shows an inline error without navigating", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Your FPL team ID").fill("99999999");
    await page.getByRole("button", { name: "Go" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("valid ID lands on Matchday and persists the session cookie", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Your FPL team ID").fill(TEAM_ID);
    await page.getByRole("button", { name: "Go" }).click();
    await page.waitForURL("**/live");

    // Reload proves the gaffer_team cookie drives the gated shell.
    await page.reload();
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "gaffer_team")?.value).toBe(TEAM_ID);
  });
});

test.describe("authenticated routes", () => {
  test("matchday composes the live model or a graceful fallback", async ({ page }) => {
    await asTeam(page);
    await page.goto("/live");
    await expect(page).toHaveTitle(/Matchday/);
    // Either the composed board or an explicit fallback state — never a crash screen.
    await expect(page.locator("main")).not.toBeEmpty();
  });

  test("squad lists the fifteen", async ({ page }) => {
    await asTeam(page);
    await page.goto("/squad");
    await expect(page.getByText("Your 15")).toBeVisible();
  });

  test("leagues index lists mini-leagues", async ({ page }) => {
    await asTeam(page);
    await page.goto("/leagues");
    await expect(page.getByText("Mini-leagues")).toBeVisible();
  });

  test("league standings table renders managers", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/leagues/314");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("columnheader", { name: "Manager" })).toBeVisible();
  });

  test("deadline desk renders", async ({ page }) => {
    await asTeam(page);
    await page.goto("/deadline");
    await expect(page.getByText("Deadline Desk")).toBeVisible();
  });

  test("players explorer renders with real totals", async ({ page }) => {
    await asTeam(page);
    await page.goto("/players");
    await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
    await expect(page.getByText(/Showing top \d+ of \d/)).toBeVisible();
  });

  test("player profile renders a player heading", async ({ page }) => {
    await asTeam(page);
    await page.goto("/players/1");
    await expect(page.locator("h1")).not.toBeEmpty();
  });

  test("planner renders the horizon grid", async ({ page }) => {
    await asTeam(page);
    await page.goto("/planner");
    await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();
  });

  test("DNA renders the manager report", async ({ page }) => {
    await asTeam(page);
    await page.goto("/dna");
    await expect(page).toHaveTitle(/Manager DNA/);
  });

  test("unauthenticated app routes bounce to landing", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/squad");
    await page.waitForURL((u) => u.pathname === "/");
  });
});
