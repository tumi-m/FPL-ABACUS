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
    // scoped past the route announcer, which also carries role=alert
    await expect(page.getByText("No team with that ID")).toBeVisible();
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
    // The status chip lives in the header now — it used to float over the page
    // at the bottom of the viewport, which cost a strip of content on a phone.
    const chip = page.locator("header").getByRole("link", { name: /Live|Gameweek/ });
    await expect(chip).toBeVisible();
    const box = await chip.boundingBox();
    expect(box && box.y).toBeLessThan(56);
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

  test("league summary names the managers it was computed over", async ({ page }) => {
    await asTeam(page);
    await page.goto("/leagues/314");
    // "Avg 60.6" alone invites you to read it as the league average when it is
    // the average of what is loaded — after one page, the top fifty.
    await expect(page.getByText(/over top \d+ managers/i)).toBeVisible();

    // a filter changes the denominator, and the label follows it
    await page.goto("/leagues/314?topN=10");
    await expect(page.getByText(/over 10 matching managers/i)).toBeVisible();
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

  test("field renders the pitch with the seven mode controls", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/field");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("group", { name: "Field mode" })).toBeVisible();
    for (const label of ["Points", "Ownership", "Swing", "Leverage", "Correlation", "Risk", "Top"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
  });

  test("top performers ranks the market by metric and timeframe", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field?mode=top");
    const board = page.getByLabel("Top performers board");
    await expect(board).toBeVisible();
    // season frame always has data — flip to it and rank on season points
    await board.getByRole("group", { name: "Timeframe" }).getByRole("button", { name: "Season" }).click();
    await board.getByLabel("Metric").selectOption("points");
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

  test("board tickers the whole league, not just your fifteen", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/board");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "The Board" })).toBeVisible();

    // A fixture ticker you can only see your own clubs in is no ticker at all.
    const ticker = page.getByRole("region", { name: "League fixture ticker" });
    await expect(ticker).toBeVisible();
    const clubRows = ticker.getByRole("table").locator("tbody tr");
    await expect(clubRows).toHaveCount(20);

    // and it opens on the run, ranked
    await expect(ticker.getByRole("button", { name: "Best run" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("attack and defence are different fixtures, and the range re-scores", async ({ page }) => {
    await asTeam(page);
    await page.goto("/board");
    const ticker = page.getByRole("region", { name: "League fixture ticker" });
    const firstClub = () => ticker.getByRole("table").locator("tbody tr").first().locator("th").innerText();

    const attackTop = await firstClub();
    await ticker.getByRole("button", { name: "Defence" }).click();
    await expect(ticker.getByRole("button", { name: "Defence" })).toHaveAttribute("aria-pressed", "true");
    const defenceTop = await firstClub();
    // The best attacking run and the best defensive run are not the same club:
    // that is the whole reason the two are scored apart.
    expect(defenceTop).not.toBe(attackTop);

    // widening the range changes the scores without a request
    const runOf = () =>
      ticker.getByRole("table").locator("tbody tr").first().locator("td").last().innerText();
    const six = await runOf();
    await ticker.getByLabel("Last gameweek").selectOption("8");
    await expect.poll(runOf).not.toBe(six);
  });

  test("board marks your clubs and can filter to them", async ({ page }) => {
    await asTeam(page);
    await page.goto("/board");
    const ticker = page.getByRole("region", { name: "League fixture ticker" });
    const all = await ticker.getByRole("table").locator("tbody tr").count();

    await ticker.getByRole("button", { name: "My clubs" }).click();
    const mine = await ticker.getByRole("table").locator("tbody tr").count();
    expect(mine).toBeGreaterThan(0);
    expect(mine).toBeLessThan(all);
  });

  test("board keeps a position-aware read of your own squad", async ({ page }) => {
    await asTeam(page);
    await page.goto("/board");
    const squad = page.getByRole("region", { name: "Your squad's fixture runs" });
    await expect(squad).toBeVisible();
    await expect(squad.getByText(/scored on clean sheets kept/)).toBeVisible();
  });

  test("a club row on the board opens that club's players", async ({ page }) => {
    await asTeam(page);
    await page.goto("/board");
    const ticker = page.getByRole("region", { name: "League fixture ticker" });
    await ticker.getByRole("table").locator("tbody tr").first().getByRole("link").click();
    await expect(page).toHaveURL(/\/players\?club=\d+/);
    await expect(page.getByRole("button", { name: "show all clubs" })).toBeVisible();
  });

  test("field renders the pitch with faces and the gameweek picker", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/field");
    expect(res?.status()).toBe(200);
    // The title said "The Field" on the Field. It stays for screen readers and
    // for the document outline, but it takes no space on screen any more.
    const h1 = page.getByRole("heading", { level: 1, name: "The Field" });
    await expect(h1).toBeAttached();
    const title = await h1.boundingBox();
    expect(title === null || title.height <= 1).toBe(true);
    const picker = page.getByRole("combobox", { name: "Gameweek" });
    await expect(picker).toBeVisible();
    // it lists every gameweek up to the current one, not just a step either way
    expect(await picker.locator("option").count()).toBeGreaterThan(0);
    await expect(page.locator('img[src*="photos/players"]').first()).toBeVisible();
  });

  test("the ask button wears the gaffer badge instead of a question mark", async ({ page }) => {
    await asTeam(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/field");
    const ask = page.getByRole("button", { name: "Ask the Gaffer" });
    await expect(ask).toBeVisible();
    await expect(ask.locator('img[src*="gaffer-badge"]')).toBeVisible();
    await expect(ask).not.toContainText("?");
  });

  test("board hands transfers off to the planner", async ({ page }) => {
    await asTeam(page);
    await page.goto("/board");
    const handoff = page.getByRole("link", { name: /Take a run at the transfers/ });
    await expect(handoff).toBeVisible();
    await handoff.click();
    await expect(page).toHaveURL(/\/planner/);
  });

  test("field carries the decision board and the artwork switch", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field");
    // faces or kits, persisted per device
    const artwork = page.getByRole("group", { name: "Player artwork" }).first();
    await expect(artwork).toBeVisible();
    await artwork.getByRole("button", { name: "Kits" }).click();
    await expect(page.locator('svg[aria-label$="kit"]').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('svg[aria-label$="kit"]').first()).toBeVisible();
    await page.getByRole("group", { name: "Player artwork" }).first().getByRole("button", { name: "Faces" }).click();

    // the five decision charts live under the pitch
    const board = page.getByRole("region", { name: "Decision board" });
    await expect(board).toBeVisible();
    await expect(board.getByText("Process vs outcome")).toBeVisible();
    await expect(board.getByText("Against expectation")).toBeVisible();
    await expect(board.getByText(/The Ledger/)).toBeVisible();
  });

  test("top performers switches between actual, expected and the gap", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field?mode=top");
    const region = page.getByRole("region", { name: "Top performers board" });
    await expect(region).toBeVisible();
    await region.getByRole("group", { name: "Board" }).getByRole("button", { name: "Actual" }).click();
    await expect(region.getByRole("table").first()).toBeVisible();
    // the engineered view adds actual-vs-expected columns and its charts
    await region.getByRole("group", { name: "Board" }).getByRole("button", { name: "Over / under" }).click();
    await expect(region.getByText(/shrunk for minutes/).first()).toBeVisible();
  });

  test("bonus board ranks the 1-2-3 and explains the conversion", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field?mode=bonus");
    await expect(page.getByRole("heading", { name: "Bonus" })).toBeVisible();
    await expect(page.getByText(/BPS spent per bonus point taken/)).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
  });

  test("defcon monsters ranks defensive work against the scoring line", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field?mode=defcon");
    await expect(page.getByRole("heading", { name: "DEFCON monsters" })).toBeVisible();
    await expect(page.getByText(/Defenders score two points at ten/)).toBeVisible();
    await expect(page.getByRole("group", { name: "Position" })).toBeVisible();
  });

  test("the boards live on the Field and the old routes still land there", async ({ page }) => {
    await asTeam(page);
    // Bonus and DEFCON were pages of their own for a release; the links kept.
    await page.goto("/bonus");
    await expect(page).toHaveURL(/\/field\?mode=bonus/);
    await page.goto("/defcon");
    await expect(page).toHaveURL(/\/field\?mode=defcon/);

    // and the mode control on the Field itself reaches all three boards
    const modes = page.getByRole("group", { name: "Field mode" });
    await modes.getByRole("button", { name: "Bonus" }).click();
    await expect(page.getByRole("heading", { name: "Bonus" })).toBeVisible();
    await modes.getByRole("button", { name: "Top" }).click();
    await expect(page.getByRole("region", { name: "Top performers board" })).toBeVisible();
  });

  test("the artwork preference follows you off the Field", async ({ page }) => {
    await asTeam(page);
    // Set it on the Field, then check the boards that never showed the switch.
    await page.goto("/field");
    await page
      .getByRole("group", { name: "Player artwork" })
      .first()
      .getByRole("button", { name: "Kits" })
      .click();
    await expect(page.locator('svg[aria-label$="kit"]').first()).toBeVisible();

    for (const route of ["/planner", "/field?mode=bonus", "/field?mode=defcon"]) {
      await page.goto(route);
      await expect(page.locator('svg[aria-label$="kit"]').first()).toBeVisible();
    }

    // and back off again, from the planner's own switch
    await page.goto("/planner");
    await page
      .getByRole("group", { name: "Player artwork" })
      .first()
      .getByRole("button", { name: "Faces" })
      .click();
    await expect(page.locator('svg[aria-label$="kit"]')).toHaveCount(0);
  });

  test("nothing floats over the page above the thumb bar", async ({ page }) => {
    await asTeam(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/live");

    // The status pill used to sit fixed above the thumb bar, on top of the
    // content. It is a header chip now, and the stat-board strip went with the
    // boards themselves — so the header and the thumb bar are the only fixed
    // furniture, and the content between them is nobody else's.
    await expect(page.getByRole("navigation", { name: "Stat boards" })).toHaveCount(0);
    const thumb = page.getByRole("navigation", { name: "Primary mobile" });
    await expect(thumb).toBeVisible();
    const bar = await thumb.boundingBox();
    expect(bar).not.toBeNull();

    const intruders = await page.locator("body *").evaluateAll((nodes, barTop) =>
      nodes
        .filter((n) => {
          const s = getComputedStyle(n);
          if (s.position !== "fixed" || s.display === "none" || s.visibility === "hidden") return false;
          const r = n.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          // decorative full-bleed washes are not furniture
          if (n.getAttribute("aria-hidden") === "true") return false;
          // anything sitting in the content band between header and thumb bar
          return r.top > 56 && r.bottom <= barTop;
        })
        .map((n) => n.getAttribute("aria-label") ?? (n.className || n.tagName)),
      (await thumb.boundingBox())!.y,
    );
    expect(intruders).toEqual([]);

    // the status is in the header instead, where it covers nothing
    await expect(page.locator("header").getByRole("link", { name: /Live|Gameweek/ })).toHaveCount(1);

    // and every destination keeps a 44px target
    for (const h of await thumb.locator("a").evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height))) {
      expect(h).toBeGreaterThanOrEqual(44);
    }
  });

  test("thumb bar carries the five mid-gameweek destinations", async ({ page }) => {
    await asTeam(page);
    // The thumb bar is the small-screen navigation — it is hidden from lg up.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/live");
    const bar = page.getByRole("navigation", { name: "Primary mobile" });
    await expect(bar).toBeVisible();
    for (const label of ["Matchday", "Field", "Planner", "Board", "Leagues"]) {
      await expect(bar.getByRole("link", { name: label })).toBeVisible();
    }
    // the Arcade came off the bar — it hangs off the badge in the header
    await expect(bar.getByRole("link", { name: "Arcade" })).toHaveCount(0);
    await expect(bar.locator("a")).toHaveCount(5);
  });

  test("the brand opens the Arcade and the team pill goes back to the gate", async ({ page }) => {
    await asTeam(page);
    await page.goto("/live");
    await page.locator("header").getByRole("link", { name: /The Arcade/ }).click();
    await expect(page).toHaveURL(/\/arcade/);
    await expect(page.getByRole("heading", { name: "The Arcade" })).toBeVisible();

    // The gate stays reachable now that the brand no longer points at it: the
    // team pill carries it on a desktop header, and the Arcade carries it on a
    // phone, where that pill is hidden.
    await page.locator("main").getByRole("link", { name: "Change team" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);

    await page.goto("/live");
    await page.locator("header").getByRole("link", { name: /change team/i }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });

  test("a phone reaches the gate through the Arcade", async ({ page }) => {
    await asTeam(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/live");
    // the team pill is desktop-only, so the brand is the whole route in
    await expect(page.locator("header").getByRole("link", { name: /change team/i })).toBeHidden();
    await page.locator("header").getByRole("link", { name: /The Arcade/ }).click();
    await expect(page).toHaveURL(/\/arcade/);
    await page.locator("main").getByRole("link", { name: "Change team" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
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

  test("planner ranks the market and stages a transfer", async ({ page }) => {
    await asTeam(page);
    const res = await page.goto("/planner");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Transfer Planner" })).toBeVisible();

    // Nothing staged yet: the market is unarmed and says so.
    const market = page.getByRole("region", { name: "Player market" });
    await expect(market).toBeVisible();
    await expect(market.getByText("pick who leaves first")).toBeVisible();

    // Put a midfielder on the block; the market follows his position.
    const pitch = page.getByRole("group", { name: "Your squad on the pitch" });
    await pitch.getByRole("button", { name: /Midfielder/ }).first().click();
    await expect(market.getByRole("button", { name: "MID", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Bring in the top legal replacement; the plan reacts.
    const pick = market.locator("tbody tr button:not([disabled])").first();
    if ((await pick.count()) === 0) {
      await expect(market.getByText(/short|Already/).first()).toBeVisible();
      return;
    }
    await pick.click();
    await expect(page.getByRole("region", { name: "Staged transfers" })).toBeVisible();
    await expect(page.getByText(/1 transfer staged/i)).toBeVisible();

    // Undo puts the desk back.
    await page.getByRole("button", { name: /^Undo/ }).first().click();
    await expect(page.getByText(/No transfers staged|free transfers banked/)).toBeVisible();
  });

  test("planner market filters by search and price", async ({ page }) => {
    await asTeam(page);
    await page.goto("/planner");
    const market = page.getByRole("region", { name: "Player market" });
    const rows = market.locator("tbody tr");
    const before = await rows.count();
    await market.getByPlaceholder("Search a player or club code").fill("zzzznobody");
    await expect(market.getByText(/Nothing matches those filters/)).toBeVisible();
    await market.getByPlaceholder("Search a player or club code").fill("");
    await expect(rows).toHaveCount(before);
  });

  test("planner ticker ranks clubs by their run", async ({ page }) => {
    await asTeam(page);
    await page.goto("/planner");
    await page.getByRole("button", { name: "Fixture ticker" }).click();
    const ticker = page.getByRole("region", { name: "Fixture ticker" });
    await expect(ticker).toBeVisible();
    const totals = ticker.locator("tbody tr td:last-child");
    const first = Number(await totals.first().innerText());
    const last = Number(await totals.last().innerText());
    expect(first).toBeGreaterThanOrEqual(last);
  });

  test("planner price watch labels its estimates", async ({ page }) => {
    await asTeam(page);
    await page.goto("/planner");
    await page.getByRole("button", { name: "Price watch" }).click();
    const watch = page.getByRole("region", { name: "Price watch" });
    await expect(watch).toBeVisible();
    await expect(watch.getByRole("group", { name: "Price direction" })).toBeVisible();
    await expect(watch.getByText(/every figure is an estimate/)).toBeVisible();
  });

  test("planner keeps independent plan slots", async ({ page }) => {
    await asTeam(page);
    await page.goto("/planner");
    const tabs = page.getByRole("group", { name: "Plans" });
    await expect(tabs.getByRole("button", { name: /Plan A/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "New plan" }).click();
    await expect(tabs.getByRole("button", { name: /^Plan B/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Delete plan" }).click();
    await expect(tabs.getByRole("button", { name: /Plan A/ })).toHaveAttribute("aria-pressed", "true");
    await expect(tabs.getByRole("button", { name: /^Plan B/ })).toBeHidden();
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
