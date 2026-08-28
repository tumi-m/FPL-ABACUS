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

  test("valid ID confirms, lands on Home and persists the session cookie", async ({ page }) => {
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
  test("home composes the live model or a graceful fallback", async ({ page }) => {
    await asTeam(page);
    await page.goto("/live");
    await expect(page).toHaveTitle(/Home/);
    // The status chip lives in the header now — it used to float over the page
    // at the bottom of the viewport, which cost a strip of content on a phone.
    const chip = page.locator("header").getByRole("link", { name: /Live|Gameweek/ });
    await expect(chip).toBeVisible();
    const box = await chip.boundingBox();
    expect(box && box.y).toBeLessThan(56);
    // Either the composed board or an explicit fallback state — never a crash screen.
    await expect(page.locator("main")).not.toBeEmpty();
  });

  test("home leads with the round's scores, grouped by state", async ({ page }) => {
    await asTeam(page);
    await page.goto("/live");
    const board = page.getByRole("region", { name: "Scoreboard" });
    await expect(board).toBeVisible();
    // results carry an actual scoreline, not a placeholder dash
    await expect(board.getByText(/\d+–\d+/).first()).toBeVisible();
    await expect(board.getByRole("heading", { name: /Results|In play|To come/ }).first()).toBeVisible();
  });

  test("home carries the same gameweek picker as the Field", async ({ page }) => {
    await asTeam(page);
    await page.goto("/live");
    const picker = page.getByRole("combobox", { name: "Gameweek" });
    await expect(picker).toBeVisible();
    expect(await picker.locator("option").count()).toBeGreaterThan(0);
  });

  test("regret and relief price the branches instead of showing dashes", async ({ page }) => {
    await asTeam(page);
    await page.setViewportSize({ width: 1300, height: 900 });
    await page.goto("/live");
    const card = page.getByRole("region", { name: "Regret and relief" });
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();

    // The card used to render an empty bar and two em-dashes whenever the rank
    // curve was missing. Ranks or points, it has to say something.
    const best = card.getByText(/Best avoided loss/i).locator("xpath=following-sibling::dd[1]");
    await expect(best).not.toHaveText("—");
    await expect(best).toHaveText(/pts|k|,|\d/);
  });

  test("my team lists the fifteen with faces", async ({ page }) => {
    await asTeam(page);
    await page.goto("/squad");
    await expect(page.getByRole("heading", { name: "My team" })).toBeVisible();
    const rows = page.locator("main ul > li");
    await expect(rows).toHaveCount(15);
    // the identity block is a face (or its kit stand-in), not a bare crest
    await expect(rows.first().locator("img, svg").first()).toBeVisible();
  });

  test("home links through to my team", async ({ page }) => {
    await asTeam(page);
    await page.goto("/live");
    await page.getByRole("link", { name: "My team" }).click();
    await expect(page).toHaveURL(/\/squad/);
    await expect(page.getByRole("heading", { name: "My team" })).toBeVisible();
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
    // A real league off the index, not 314: the Overall league has eleven
    // million entries, its ranks read 0 during a live gameweek, and hammering
    // it from CI is rude besides.
    await page.goto("/leagues");
    const firstLeague = page.locator('a[href^="/leagues/"]').first();
    if ((await firstLeague.count()) === 0) return; // no leagues on this account
    const href = (await firstLeague.getAttribute("href"))!;

    await page.goto(href);
    // "Avg 60.6" alone invites you to read it as the league average when it is
    // the average of what is loaded. Either wording is correct — "top 50" while
    // pages remain, "all 137" once they do not — but it must name a count.
    await expect(page.getByText(/over (top|all) \d+ managers?/i)).toBeVisible();

    // A filter changes the denominator and the label follows it. How many rows
    // survive depends on the league and the week, so the assertion is on the
    // wording, not on a number that moves every gameweek.
    await page.goto(`${href}?topN=10`);
    await expect(page.getByText(/over \d+ matching managers?/i)).toBeVisible();
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
      // The standings arrive server-rendered, and under a loaded runner that
      // first paint can take longer than the default five seconds — the last
      // fixed timeout in this test, and the one that still flaked.
      const more = page.getByRole("button", { name: /load 50 more/i });
      await expect(more).toBeVisible({ timeout: 20_000 });
      await more.click();
      // Let the RSC fetch land before polling for its result; a loaded runner
      // can take a few seconds and the poll should not be racing it.
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
      /*
       * Assert the outcome, never the URL.
       *
       * "Load 50 more" is a Link into a force-dynamic route, so Next fetches
       * the next page's payload before it touches the address bar. Polling for
       * `?page=2` was therefore polling for an implementation detail on the
       * slowest possible path, and under a loaded runner it was the assertion
       * that kept flaking while the feature itself worked. What the reader
       * actually gets is more rows, or an honest end of the list — so that is
       * what is checked, with room for a cold server render underneath it.
       */
      await expect
        .poll(async () => {
          if ((await page.getByText(/End of standings/).count()) > 0) return "ended";
          return (await page.locator("tbody tr").count()) > dataRows ? "rows" : "waiting";
        }, { timeout: 30_000 })
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
    // either the head-to-head header loads or an honest reason shows
    await expect(
      page.getByText(/no side for GW|No FPL team with id|FPL didn't answer|Entry \d+|You/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("a loaded rival leaves every token on the pitch tappable", async ({ page }) => {
    // Compare used to render bare tokens instead of buttons, so loading a
    // rival killed the peek sheet for all twenty-two players on the pitch.
    await asTeam(page);
    await page.goto("/field");
    await page.getByPlaceholder(/Compare id or name/i).fill("1851681");
    await page.getByRole("button", { name: /^Compare$/ }).click();

    // The ordinary pitch uses the same locator, so wait for a mark only the
    // compare view draws — otherwise the count races the rival's render and
    // passes on your own eleven plus the bench.
    await expect(page.getByText(/shared — those cancel out/)).toBeVisible({ timeout: 15_000 });

    const tokens = page.locator('ul li button[aria-label*="open details"]');
    // both halves plus your bench, not just your own side
    expect(await tokens.count()).toBeGreaterThan(15);

    await tokens.first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  });

  test("a compare that cannot load says which of the four things went wrong", async ({ page }) => {
    // One sentence used to cover a typo'd id, a manager who joined late and
    // FPL being down. Only one of the three was ever true.
    await asTeam(page);
    await page.goto("/field");
    await page.getByPlaceholder(/Compare id or name/i).fill("999999999");
    await page.getByRole("button", { name: /^Compare$/ }).click();
    // Next's own route announcer is also role=alert, so target the Field's note
    await expect(page.locator('p[role="alert"]')).toContainText(
      /No FPL team with id|no side for GW|FPL didn't answer/,
      { timeout: 15_000 },
    );
  });

  test("the squad charts become head-to-head when a rival is loaded", async ({ page }) => {
    await asTeam(page);

    // Solo: the charts describe your fifteen and name nobody else.
    await page.goto("/field?mode=points");
    await expect(page.locator("section[aria-label='Your gameweek']")).toBeVisible();
    await expect(page.getByText(/Points by position — \d+ on the board/)).toBeVisible();

    // With a rival they change subject, and say whose colour is whose.
    await page.goto("/field?mode=points&compare=4242");
    const h2h = page.locator("section[aria-label='You against them']");
    await expect(h2h).toBeVisible();
    await expect(h2h.getByText(/Points by position — you \d+, /)).toBeVisible();
    await expect(h2h.getByText("Bonus leaders — both squads")).toBeVisible();
    // Four charts, each carrying the head-to-head eyebrow rather than its solo one.
    expect(await h2h.getByText("Head to head").count()).toBe(4);

    // The season block stays yours, and has to say so rather than sit
    // unlabelled next to four charts that are about both of you.
    await expect(page.getByText(/Your squad only/)).toBeVisible();
  });

  test("the gap breakdown adds up to the scoreline", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field?mode=points&compare=4242");
    const heading = page.getByText(/What is making the difference/i);
    if ((await heading.count()) === 0) return; // identical squads — nothing to break down

    // The gap is stated once as a headline and again as a list of causes. If
    // those two ever disagree the breakdown is lying, and a breakdown that
    // does not reconcile is worse than no breakdown.
    const chip = page.locator("span[aria-label*='points ahead'], span[aria-label*='points behind']");
    const gap = Number((await chip.getAttribute("aria-label"))!.match(/(\d+) points/)![1]) *
      ((await chip.getAttribute("aria-label"))!.includes("behind") ? -1 : 1);

    const card = heading.locator("xpath=..");
    const parts = (await card.locator("span.num-tabular").allInnerTexts())
      .map((t) => t.replace(/\u2212/, "-").trim())
      .filter((t) => /^[+-]?\d+$/.test(t))
      .map(Number);
    const rest = await card.locator("p.num-tabular").innerText().catch(() => "");
    const remainder = rest ? Number((rest.match(/([+\u2212-]\d+)\./) ?? ["", "0"])[1].replace("\u2212", "-")) : 0;

    // Guard against a green tick that parsed nothing: a reconciliation test
    // over an empty list reconciles beautifully and checks nothing.
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.reduce((a, b) => a + b, 0) + remainder).toBe(gap);
  });

  test("the pitch draws FPL's own formation, one line per position", async ({ page }) => {
    // A row of five used to wrap at phone widths, so a 3-5-2 drew itself as a
    // 3-4-1-2 — a shape the game does not have.
    await asTeam(page);
    for (const width of [1280, 393, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/field");
      const rows = await page.evaluate(() => {
        const turf = document.querySelector(".on-turf");
        if (!turf) return null;
        // the four position lines, before the bench list
        return [...turf.querySelectorAll("ul")].slice(0, 4).map((u) => ({
          n: u.querySelectorAll(":scope > li").length,
          overflow: u.scrollWidth - u.clientWidth,
        }));
      });
      expect(rows, `pitch at ${width}px`).toHaveLength(4);
      expect(rows!.reduce((s, r) => s + r.n, 0), `starters at ${width}px`).toBe(11);
      // one keeper, and nobody spilling onto a line of their own
      expect(rows![0].n, `keepers at ${width}px`).toBe(1);
      for (const r of rows!) {
        expect(r.overflow, `row overflow at ${width}px`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("the league scatter costs nothing until it is scrolled to", async ({ page }) => {
    await asTeam(page);
    const boardCalls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/gaffer/boards")) boardCalls.push(r.url());
    });

    await page.goto("/field");
    await expect(page.getByText("Creating, against everything he does")).toBeAttached({
      timeout: 15_000,
    });
    // the pitch is the page; the league behind it is not worth a request until
    // somebody actually scrolls to it
    expect(boardCalls).toHaveLength(0);

    const figure = page.locator('figure:has-text("Creating, against everything he does")');
    await figure.scrollIntoViewIfNeeded();
    await expect.poll(() => boardCalls.length, { timeout: 15_000 }).toBeGreaterThan(0);

    // either the scatter draws or it says honestly why it cannot
    await expect(
      figure.locator("svg circle").first().or(figure.getByText(/Nobody has|did not answer/)),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("the league scatter names its leaders and opens their pages", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field");
    const figure = page.locator('figure:has-text("Creating, against everything he does")');
    await figure.scrollIntoViewIfNeeded();

    // it opens on the top fifteen, and every one of them is named and tappable
    const links = figure.locator("svg a[href^='/players/']");
    await expect(links.first()).toBeVisible({ timeout: 15_000 });
    const named = await links.count();
    expect(named).toBeGreaterThan(0);
    expect(named).toBeLessThanOrEqual(15);
    await expect(figure.locator("svg a text").first()).toBeVisible();

    // the whole market is one tap away and is a bigger crowd than the leaders
    const leaders = await figure.locator("svg circle").count();
    await figure.getByRole("button", { name: "All", exact: true }).nth(1).click();
    await expect
      .poll(async () => figure.locator("svg circle").count(), { timeout: 10_000 })
      .toBeGreaterThan(leaders);

    // and a named dot is a real link out
    await figure.getByRole("button", { name: "Top 15" }).click();
    await figure.locator("svg a[href^='/players/'] circle").first().click({ force: true });
    await expect(page).toHaveURL(/\/players\/\d+/, { timeout: 15_000 });
  });

  test("combinations prices two sides at the same spend", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field/combos");
    await expect(page.getByRole("heading", { name: "Combinations" })).toBeVisible();

    const duel = page.locator('section[aria-label="Head to head"]');
    // it opens with a real comparison rather than two empty columns
    await expect(duel.locator("select")).toHaveCount(2);
    // the verdict paragraph, not the section blurb above it
    await expect(
      duel.getByText(/Side [AB] is £|Both sides cost £/),
    ).toBeVisible({ timeout: 15_000 });

    // adding a player to a side moves that side's total
    const before = await duel.locator("p.fig-num").first().innerText();
    const add = duel.locator("select").first();
    const value = await add.locator("option").nth(1).getAttribute("value");
    await add.selectOption(value!);
    await expect.poll(async () => duel.locator("p.fig-num").first().innerText()).not.toBe(before);

    // the ladder and the top thirty both render
    await expect(
      page.locator('section[aria-label="What each budget buys"] li').first(),
    ).toBeVisible();
    await expect(
      page.locator('section[aria-label="Top thirty combinations"] tbody tr'),
    ).toHaveCount(30);
  });

  test("the combination boards switch between the three rankings", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field/combos");
    const board = page.locator('section[aria-label="Top thirty combinations"]');
    const firstPair = () => board.locator("tbody tr th").first().innerText();

    const onPoints = await firstPair();
    await board.getByRole("button", { name: "Best value" }).click();
    await expect.poll(firstPair).not.toBe(onPoints);
    await expect(board.locator("tbody tr")).toHaveCount(30);

    await board.getByRole("button", { name: "Least owned" }).click();
    await expect(board.locator("tbody tr")).toHaveCount(30);
  });

  test("the Planner points at the combination board", async ({ page }) => {
    await asTeam(page);
    await page.goto("/planner");
    // Named, not riddled: on a phone the Planner is the only way into
    // Combinations, which has no thumb slot, so the link says what it opens.
    await page.getByRole("button", { name: "Combinations" }).click();
    await expect(page).toHaveURL(/\/combos/);
  });

  test("the Field opens the combination board, and the old route still lands there", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field");
    // Where the user looked for it: beside Club numbers and Points contribution.
    await page.getByRole("button", { name: "Combinations" }).click();
    await expect(page).toHaveURL(/\/field\/combos/);
    await expect(page.getByRole("heading", { name: "Combinations" })).toBeVisible();
    // It shipped at /combos for one release; that link has to keep working.
    await page.goto("/combos");
    await expect(page).toHaveURL(/\/field\/combos/);
  });

  test("Combinations is reachable from the chrome on a desktop", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field");
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Combinations" }).click();
    await expect(page).toHaveURL(/\/combos/);
  });

  test("club numbers renders six sortable boards for all twenty clubs", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field/clubs");
    await expect(page.getByRole("heading", { name: "Club numbers" })).toBeVisible();

    const tables = page.locator("table");
    await expect(tables).toHaveCount(6);
    // every club gets a row on every board, whether or not it has played
    await expect(tables.first().locator("tbody tr")).toHaveCount(20);

    // Sorting is the whole interface, so assert the column actually ends up
    // ordered rather than just that something moved.
    const board = tables.first();
    await board.getByRole("button", { name: "Sort by Goals scored" }).click();
    const column = async () => {
      // nth-child counts the club <th> as child 1, so: 2 = Pl, 3 = xG, 4 = G
      const cells = await board.locator("tbody tr td:nth-child(4)").allInnerTexts();
      return cells.map((t) => Number(t.replace(/[^\d.-]/g, "")));
    };
    const desc = await column();
    expect(desc).toHaveLength(20);
    expect([...desc].sort((a, b) => b - a)).toEqual(desc);

    // and clicking the same header again flips it
    await board.getByRole("button", { name: "Sort by Goals scored" }).click();
    const asc = await column();
    expect([...asc].sort((a, b) => a - b)).toEqual(asc);
  });

  test("the Field links out to the club boards", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field");
    await page.getByRole("button", { name: "Club numbers" }).click();
    await expect(page).toHaveURL(/\/field\/clubs/);
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

  test("the pitch names its marks, bonus included", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field");
    // Bonus is worth up to three points and read as decoration when it was
    // three pips on a token corner. It is a badge in the strip now, and the
    // key names it without being opened — a legend folded inside a disclosure
    // is a legend nobody reads.
    const key = page.locator("details").filter({ hasText: "all marks" }).first();
    await expect(key).toBeVisible();
    for (const mark of ["Goal", "Assist", "Bonus", "Clean sheet", "Saves"]) {
      await expect(key.getByText(mark, { exact: true }).first()).toBeVisible();
    }
    // and the rarer marks are one tap away
    await key.getByText("all marks").click();
    await expect(key.getByRole("listitem").filter({ hasText: "DEFCON ring" })).toBeVisible();
  });

  test("risk carries the treatment table with the injury and the return date", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field?mode=risk");
    const table = page.getByRole("region", { name: "Treatment table" });
    await expect(table).toBeVisible();
    // Either somebody is flagged — with FPL's own wording — or nobody is, and
    // it says that rather than showing an empty list.
    await expect(
      table.getByText(/flagged/).or(table.getByText(/fit and available/)).first(),
    ).toBeVisible();
  });

  test("the field carries the season charts under the gameweek", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field");
    const season = page.getByRole("region", { name: "Your fifteen this season" });
    await season.scrollIntoViewIfNeeded();
    // The gameweek says what happened; these say whether the players are good.
    for (const title of [
      "Goals against expected",
      "Against expectation",
      "Who actually starts",
      "Points per pound",
    ]) {
      await expect(season.getByText(title, { exact: true }).first()).toBeVisible();
    }
  });

  test("points attribution shows the working, not just the total", async ({ page }) => {
    await asTeam(page);
    await page.goto("/field/points");
    await expect(page.getByText("Where your points come from")).toBeVisible();
    await expect(page.getByText("Where the score came from")).toBeVisible();
    const table = page.getByRole("region", { name: "Points by player" });
    await expect(table).toBeVisible();
    // every one of the fifteen, with its own stat line
    await expect(table.locator("tbody tr")).toHaveCount(15);
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
    for (const label of ["Home", "Field", "Planner", "Board", "Leagues"]) {
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

  test("the deadline calendar feed is a calendar any client can subscribe to", async ({ page }) => {
    const res = await page.request.get("/api/calendar/deadlines.ics");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Every line CRLF-terminated and inside the 75-octet limit: iOS refuses a
    // feed that breaks either, and it refuses it silently.
    for (const line of body.split("\r\n").slice(0, -1)) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(body).toContain("BEGIN:VALARM");
    expect(body).toContain("TRIGGER:-PT120M");
  });

  test("the calendar feed takes its reminder lead from the URL", async ({ page }) => {
    const quiet = await (await page.request.get("/api/calendar/deadlines.ics?alarm=none")).text();
    expect(quiet).toContain("BEGIN:VCALENDAR");
    expect(quiet).not.toContain("BEGIN:VALARM");

    const day = await (await page.request.get("/api/calendar/deadlines.ics?alarm=1440")).text();
    expect(day).toContain("TRIGGER:-PT1440M");

    const one = await (await page.request.get("/api/calendar/deadlines.ics?only=next")).text();
    expect((one.match(/BEGIN:VEVENT/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  test("the deadline desk offers the calendar, and the Planner points at it", async ({ page }) => {
    await asTeam(page);
    await page.goto("/planner");
    await page.getByRole("button", { name: /Deadline reminders/i }).click();
    await expect(page).toHaveURL(/\/deadline/);

    const card = page.locator("section[aria-labelledby='cal-h']");
    await expect(card.getByRole("heading", { name: /Never miss a deadline/i })).toBeVisible();
    // The subscribe link has to be webcal:, or iOS imports a dead copy of
    // today's events instead of subscribing to the feed.
    const apple = card.getByRole("link", { name: /Apple Calendar/i });
    expect(await apple.getAttribute("href")).toMatch(/^webcal:\/\/.+deadlines\.ics/);

    // Choosing a lead time rewrites the links rather than storing a preference.
    await card.getByRole("button", { name: /1 hour$/ }).click();
    expect(await apple.getAttribute("href")).toContain("alarm=60");
  });

  test("deadline desk renders", async ({ page }) => {
    await asTeam(page);
    await page.goto("/deadline");
    // getByText("Deadline Desk") matched both the sr-only h1 and the document
    // <title>, so it was a strict-mode violation whenever the title happened to
    // be in the DOM at check time — green or red depending on the race.
    await expect(page.getByRole("heading", { name: "Deadline Desk" })).toBeAttached();
    // and something a person can actually see
    await expect(page.getByRole("region", { name: /Act now|Watch|Settled/ }).first()).toBeVisible();
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
