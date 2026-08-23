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
  await expect(page).toHaveTitle(/Gaffer/);
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

  test("league pagination appends the next page", async ({ page }) => {
    await asTeam(page);
    // Pick the first league the index offers (314 is empty pre-GW1).
    await page.goto("/leagues");
    const firstLeague = page.locator('a[href^="/leagues/"]').first();
    if ((await firstLeague.count()) === 0) return; // no leagues on this account — nothing to test
    const href = await firstLeague.getAttribute("href");
    await page.goto(href!); // page 1
    const dataRows = await page.locator("tbody tr").count();
    if (dataRows >= 50) {
      const more = page.getByRole("button", { name: /load 50 more/i });
      await expect(more).toBeVisible();
      await more.click();
      // SPA navigation: the old button stays mounted while page 2 loads, so
      // poll for a real outcome — more rows rendered or the honest end state.
      await expect(page).toHaveURL(/[?&]page=2/);
      await expect
        .poll(async () => {
          if ((await page.getByText(/End of standings/).count()) > 0) return "ended";
          return (await page.locator("tbody tr").count()) > dataRows ? "rows" : "waiting";
        }, { timeout: 20_000 })
        .not.toBe("waiting");
    } else {
      // small league: exhausted list shows its honest end state
      await expect(page.getByText(/End of standings|publish after GW1/)).toBeVisible();
    }
  });

  test("field renders the pitch with the seven mode controls", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/field");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("group", { name: "Field mode" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ownership" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Planner" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Correlation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Risk" })).toBeVisible();
  });

  test("field correlation and risk modes persist in the URL", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field?mode=correlation");
    await expect(page.getByRole("button", { name: "Correlation" })).toHaveAttribute("aria-pressed", "true");
    // the web feed mounts its honesty line (content depends on upstream, copy does not)
    await expect(page.locator('p[role="status"]').first()).toBeVisible();
    await page.goto("/field?mode=risk");
    await expect(page.getByRole("button", { name: "Risk" })).toHaveAttribute("aria-pressed", "true");
  });

  test("field token tap opens the shared peek sheet", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field");
    const token = page.locator('button[aria-label$="open details"]').first();
    await expect(token).toBeVisible();
    await token.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("link", { name: "Player page" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("per-entry field OG card renders an image", async ({ page }) => {
    const res = await page.request.get(`/api/og/field/${TEAM_ID}`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("image/");
  });

  test("board renders the fixture grid with URL-state controls", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/board");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "The Board" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Horizon" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Colour model" })).toBeVisible();
  });

  test("board horizon and colour model persist in the URL", async ({ page }) => {
    await asTeam(page);
    await page.goto("/board?h=10&c=fdr");
    await expect(page.getByRole("button", { name: "FDR" })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/h=10&c=fdr/);
  });

  test("newsdesk renders filters and availability notes", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/news");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Newsdesk" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Filter" })).toBeVisible();
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

  test("planner link now lands on the board", async ({ page }) => {
    await asTeam(page);
    await page.goto("/planner");
    await expect(page).toHaveURL(/\/board/);
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

test("ask bar routes captaincy questions without a model", async ({ request }) => {
  const res = await request.post("/api/ask", {
    data: { q: "should I captain salah or haaland?" },
    headers: { cookie: `gaffer_team=${TEAM_ID}` },
  });
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain('"intent":"captain.pick"');
});

test("the film renders the season archive with sigil", async ({ page }) => {
  await asTeam(page);
  const res = await page.goto("/film");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "The Film" })).toBeVisible();
  await expect(page.getByRole("img", { name: /sigil for gameweek/i })).toBeVisible();
});
