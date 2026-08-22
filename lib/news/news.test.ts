import { describe, expect, it } from "vitest";
import { NEWS_SOURCES, parseRedditJson, parseRss, urlHashOf } from "@/lib/news/sources";
import { buildTagger, relevanceOf, tagItem } from "@/lib/news/tagger";

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Salah &amp; Ødegaard star in six-goal thriller</title>
    <link>https://www.bbc.co.uk/sport/football/example-1</link>
    <pubDate>Fri, 21 Aug 2026 17:30:00 GMT</pubDate>
    <description><![CDATA[<p>Mohamed Salah scored twice.</p>]]></description>
  </item>
  <item>
    <title>Transfer window: club complete signing</title>
    <link>https://www.bbc.co.uk/sport/football/example-2</link>
    <pubDate>bogus-date</pubDate>
  </item>
</channel></rss>`;

const SAMPLE_REDDIT = JSON.stringify({
  data: {
    children: [
      {
        data: {
          title: "Post-Match Thread",
          permalink: "/r/FantasyPL/comments/abc/post_match/",
          created_utc: 1755772800,
          link_flair_text: "Discussion",
        },
      },
      { data: { title: "no link here" } },
    ],
  },
});

describe("parseRss", () => {
  it("extracts items with decoded entities and CDATA stripped", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Salah & Ødegaard star in six-goal thriller");
    expect(items[0].summary).toBe("Mohamed Salah scored twice.");
    expect(items[0].url).toContain("example-1");
    expect(items[0].publishedAt.getUTCFullYear()).toBe(2026);
  });

  it("falls back to now for unparseable dates", () => {
    const items = parseRss(SAMPLE_RSS);
    const skew = Math.abs(Date.now() - items[1].publishedAt.getTime());
    expect(skew).toBeLessThan(60_000);
  });
});

describe("parseRedditJson", () => {
  it("maps children to items with canonical permalinks", () => {
    const items = parseRedditJson(SAMPLE_REDDIT);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://www.reddit.com/r/FantasyPL/comments/abc/post_match/");
    expect(items[0].summary).toBe("Discussion");
  });

  it("tolerates garbage", () => {
    expect(parseRedditJson("not json")).toEqual([]);
  });
});

describe("sources registry", () => {
  it("has exactly the four locked sources — no Twitter", () => {
    expect(NEWS_SOURCES.map((s) => s.id)).toEqual(["bbc", "guardian", "ffscout", "reddit"]);
  });
});

describe("tagger", () => {
  const elements = [
    { id: 1, webName: "Salah", team: 10 },
    { id: 2, webName: "Ødegaard", team: 1 },
    { id: 3, webName: "Mbeumo", team: 91 },
  ];
  const tagger = buildTagger(elements);

  it("matches names on word boundaries, case-insensitively", () => {
    const tagged = tagItem(tagger, {
      url: "https://x.example/salah-and-odegaard",
      title: "Salah and ødegaard both start",
      summary: null,
      publishedAt: new Date(),
      source: "bbc",
    });
    expect(tagged.elementIds.sort()).toEqual([1, 2]);
    expect(tagged.teamIds.sort()).toEqual([1, 10]);
  });

  it("does not match substrings inside longer words", () => {
    const tagged = tagItem(tagger, {
      url: "https://x.example/unrelated",
      title: "The salad was excellent tonight",
      summary: null,
      publishedAt: new Date(),
      source: "guardian",
    });
    expect(tagged.elementIds).toEqual([]);
  });

  it("dedupes repeated mentions in one item", () => {
    const tagged = tagItem(tagger, {
      url: "https://x.example/mbeumo-again",
      title: "Mbeumo penalty appeal: Mbeumo denied",
      summary: null,
      publishedAt: new Date(),
      source: "ffscout",
    });
    expect(tagged.elementIds).toEqual([3]);
  });

  it("relevance decays with age and rewards multi-player stories", () => {
    const now = new Date();
    const fresh = relevanceOf(
      { ...base(), elementIds: [1], teamIds: [10] },
      0.9,
      now,
    );
    const stale = relevanceOf(
      { ...base(), publishedAt: new Date(now.getTime() - 72 * 3_600_000), elementIds: [1], teamIds: [10] },
      0.9,
      now,
    );
    const spread = relevanceOf({ ...base(), elementIds: [1, 2, 3], teamIds: [1] }, 0.9, now);
    expect(stale).toBeLessThan(fresh);
    expect(spread).toBeGreaterThan(fresh);
  });
});

function base() {
  return {
    url: "https://x.example/story",
    title: "A story",
    summary: null,
    publishedAt: new Date(),
    source: "bbc",
  };
}

describe("url hashing", () => {
  it("keeps urls stable regardless of case or trailing spaces", () => {
    expect(urlHashOf("https://X.example/A")).toBe(urlHashOf("https://x.example/a"));
    expect(urlHashOf("https://x.example/a")).not.toBe(urlHashOf("https://x.example/b"));
  });
});
