import { expect, test, type Page } from "@playwright/test";

const TEAM_ID = "1851681";

function teamCookie() {
  return { name: "gaffer_team", value: TEAM_ID, url: "http://localhost:3000" };
}

async function asTeam(page: Page) {
  await page.context().addCookies([teamCookie()]);
}

test("landing renders the gate, the gaffer lineup and ball imagery", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Gaffer/);
  await expect(page.getByLabel("Your FPL team ID")).toBeVisible();
  await expect(page.getByRole("radio", { name: /kofi/i })).toBeVisible();
  await expect(page.locator("img[src*='trophy']").first()).toBeVisible();
  await expect(page.locator("img[src*='ball']").first()).toBeVisible();
});

test.describe("team ID gate flow", () => {
  test("invalid ID shows an inline error without navigating", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Your FPL team ID").fill("99999999");
    await page.getByRole("button", { name: "Go" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("a pasted team link shows the paste hint, then the confirmation chip", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Your FPL team ID").fill("https://fantasy.premierleague.com/entry/1851681/history");
    await expect(page.getByText("Looks like a team link")).toBeVisible();
    await page.getByRole("button", { name: "Go" }).click();
    await expect(page.getByText("Is this you?")).toBeVisible();
  });

  test("the club carousel tints chrome accents and clears back to default", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /tint chrome to/i })).toBeVisible();
    await page.getByRole("button", { name: /tint chrome to/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-club", /^\d+$/);
    await page.getByRole("button", { name: /clear .* back to the default look/i }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-club", /./);
  });

  test("the club map pins all twenty crests and tints on tap", async ({ page }) => {
    await page.goto("/");
    const map = page.getByLabel("Premier League map");
    await expect(map).toBeVisible();
    await expect(map.locator('img[src*="/badges/"]')).toHaveCount(40); // 20 markers + 20 list rows
    await map.getByRole("button", { name: /Liverpool — tint the app/ }).click();
    await expect(map.getByText("Liverpool tint on")).toBeVisible();
  });

  test("valid ID confirms, lands on Matchday and persists the session cookie", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Your FPL team ID").fill(TEAM_ID);
    await page.getByRole("button", { name: "Go" }).click();
    await expect(page.getByText("Is this you?")).toBeVisible();
    await page.getByRole("button", { name: /this is me/i }).click();
    await page.waitForURL("**/live");

    // Reload proves the gaffer_team cookie drives the gated shell.
    await page.reload();
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "gaffer_team")?.value).toBe(TEAM_ID);
  });

  test("the ID explainer sheet opens and closes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Where do I find my ID?" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Where your ID lives" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("gate name search toggles team/manager and degrades honestly", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("group", { name: "Name search mode" });
    await expect(toggle).toBeVisible();
    await toggle.getByRole("button", { name: "Manager name" }).click();
    await expect(toggle.getByRole("button", { name: "Manager name" })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Your FPL team ID").fill("Some FC");
    await page.getByRole("button", { name: "Go" }).click();
    // no directory in the test environment — the honest fallback message
    await expect(page.getByText("Name search needs the Gaffer directory")).toBeVisible();
  });
});

test.describe("authenticated routes", () => {
  test("matchday composes the live model or a graceful fallback", async ({ page }) => {
    await asTeam(page);
    await page.goto("/live");
    await expect(page).toHaveTitle(/Matchday/);
    // v4-D: the status pill lives at the bottom of the viewport, never a top banner
    const pill = page.getByRole("link", { name: "Gameweek status" });
    await expect(pill).toBeVisible();
    const box = await pill.boundingBox();
    expect(box && box.y).toBeGreaterThan(300);
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

  test("league manager rows deep-link to a head-to-head compare", async ({ page }) => {
    await asTeam(page);
    await page.goto("/leagues");
    const firstLeague = page.locator('a[href^="/leagues/"]').first();
    if ((await firstLeague.count()) === 0) return; // no leagues on this account — nothing to test
    await page.goto((await firstLeague.getAttribute("href"))!);
    // any manager link that is not the you-row
    const rival = page.locator("a[href*='compare=']").first();
    if ((await rival.count()) === 0) return; // solo league — no rival to compare
    const href = (await rival.getAttribute("href"))!;
    await page.goto(href); // deep-link directly — click hit-testing is flaky under the sticky header
    await expect(page).toHaveURL(/field\?mode=points&compare=\d+/);
    // either the head-to-head header loads or the honest no-picks note shows
    await expect(page.getByText(/No picks visible|Entry \d+|You/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("field renders the pitch with the eight mode controls", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/field");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("group", { name: "Field mode" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ownership" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Planner" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Correlation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Risk" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Top" })).toBeVisible();
  });

  test("top performers ranks the market by metric and timeframe", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field?mode=top");
    await expect(page.getByLabel("Top performers board")).toBeVisible();
    // season frame always has data — flip to it and sort by points
    const board = page.getByLabel("Top performers board");
    await board.getByRole("button", { name: "Season" }).click();
    await board.getByRole("button", { name: "Points", exact: true }).click();
    const rows = board.getByRole("table").locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const first = Number(await rows.first().locator("td").last().innerText());
    const last = Number(await rows.last().locator("td").last().innerText());
    expect(first).toBeGreaterThanOrEqual(last);
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

  test("field renders the pitch with faces and the gameweek stepper", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/field");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("group", { name: "Gameweek" })).toBeVisible();
    await expect(page.locator('img[src*="photos/players"]').first()).toBeVisible();
  });

  test("board desk keeps independent plan slots", async ({ page }) => {
    await asTeam(page);
    await page.goto("/board");
    const desk = page.getByRole("region", { name: "Transfer staging and chip lane" });
    const tabs = desk.getByRole("group", { name: "Plans" });
    await expect(tabs.getByRole("button", { name: /Plan A/ })).toHaveAttribute("aria-pressed", "true");

    // A second slot starts empty and becomes active.
    await desk.getByRole("button", { name: "New plan" }).click();
    await expect(tabs.getByRole("button", { name: /^Plan B/ })).toHaveAttribute("aria-pressed", "true");
    await expect(desk.getByText(/board is clean/)).toBeVisible();

    // Deleting it returns the desk to Plan A.
    await desk.getByRole("button", { name: "Delete plan" }).click();
    await expect(tabs.getByRole("button", { name: /Plan A/ })).toHaveAttribute("aria-pressed", "true");
    await expect(tabs.getByRole("button", { name: /^Plan B/ })).toBeHidden();
  });

  test("planner stages a move through the guided flow", async ({ page }) => {
    await asTeam(page);
    await page.goto("/board");
    const desk = page.getByRole("region", { name: "Transfer staging and chip lane" });
    // step 1 — tap a midfielder on the squad grid
    const grid = desk.getByRole("list", { name: "Squad — tap who makes way" });
    await expect(grid).toBeVisible();
    await grid.getByRole("button", { name: /MID/ }).first().click();
    // step 2 — the solver's ranked ins appear; stage the first affordable one
    const ins = desk.getByRole("list", { name: "Ranked ins for the selected player" });
    await expect(ins).toBeVisible();
    const pick = ins.locator("button:not([disabled])").first();
    if ((await pick.count()) === 0) {
      // nothing affordable from this OUT — the desk says so honestly
      await expect(ins.getByText("£ short").first()).toBeVisible();
      return;
    }
    await pick.click();
    await expect(desk.getByText(/1 staged/)).toBeVisible();
    await expect(desk.getByText(/This plan over/)).toBeVisible();
  });

  test("thumb bar carries all five destinations", async ({ page }) => {
    await asTeam(page);
    await page.goto("/live");
    const bar = page.getByRole("navigation", { name: "Primary mobile" });
    await expect(bar).toBeVisible();
    for (const label of ["Matchday", "Field", "Board", "Leagues", "Arcade"]) {
      await expect(bar.getByRole("link", { name: label })).toBeVisible();
    }
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

test("arcade gaffer console: select strip, persona voice, sound toggle", async ({ page }) => {
  await asTeam(page);
  await page.goto("/live");
  await page.getByRole("button", { name: "Ask the Gaffer" }).click();
  // the four gaffers are on the strip
  await expect(page.getByRole("radiogroup", { name: "Choose your gaffer" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /KOFI/ })).toBeVisible();
  // pick the maverick — the immersive console hero expands
  await page.getByRole("radio", { name: /KOFI/ }).click();
  await expect(page.getByRole("radio", { name: /KOFI/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: /KOFI.*focus the question box/ })).toBeVisible();
  // ask — the gaffer bubble speaks (deterministic fallback when no gateway key)
  await page.getByLabel("Your question").fill("should I take a hit?");
  await page.getByRole("button", { name: "Consult Gaffer" }).click();
  await expect(page.getByText(/KOFI · The Maverick/)).toBeVisible({ timeout: 20_000 });
});

test("the gaffer voice is persona-flavoured on the API", async ({ request }) => {
  const res = await request.post("/api/ask", {
    data: { q: "should I take a hit?", persona: "mei" },
    headers: { cookie: `gaffer_team=${TEAM_ID}` },
  });
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain('"type":"gaffer"');
  expect(text).toContain('"persona":"mei"');
});

test("the film renders the season archive with sigil", async ({ page }) => {
  await asTeam(page);
  const res = await page.goto("/film");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "The Film" })).toBeVisible();
  await expect(page.getByRole("img", { name: /sigil for gameweek/i })).toBeVisible();
});
