import fs from "fs";
import path from "path";
import {
  CHANNELS,
  buildAtomXml,
  buildDailyAtomXml,
  buildDailyJsonFeed,
  buildDailyRssXml,
  buildJsonFeed,
  buildOpmlXml,
  buildRssXml,
  getChannelFeed,
  getDailyEditionsFeed,
} from "../server/rssService.ts";

const DIST_DIR = path.resolve(process.cwd(), "dist");
const SITE_URL = (process.env.SITE_URL || "https://example.github.io").replace(/\/+$/, "");

function writeFileEnsureDir(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error("dist/ does not exist. Run `vite build` before `buildStaticFeeds.ts`.");
  }

  console.log(`Generating static feeds for ${SITE_URL} ...`);

  // Static channels JSON
  writeFileEnsureDir(
    path.join(DIST_DIR, "api", "channels.json"),
    JSON.stringify({ channels: CHANNELS }, null, 2)
  );

  // Generate each channel feed (XML, Atom, JSON Feed, and static API JSON)
  for (const ch of CHANNELS) {
    const feed = await getChannelFeed(ch.slug);
    const rssSelf = ch.slug === "all" ? "/rss.xml" : `/rss/${ch.slug}.xml`;
    const atomSelf = ch.slug === "all" ? "/atom.xml" : `/atom/${ch.slug}.xml`;
    const jsonSelf = ch.slug === "all" ? "/feed.json" : `/feed/${ch.slug}.json`;

    const rssXml = buildRssXml(feed, SITE_URL, rssSelf, true);
    const atomXml = buildAtomXml(feed, SITE_URL, atomSelf, true);
    const jsonFeed = buildJsonFeed(feed, SITE_URL, jsonSelf, true);

    if (ch.slug === "all") {
      writeFileEnsureDir(path.join(DIST_DIR, "rss.xml"), rssXml);
      writeFileEnsureDir(path.join(DIST_DIR, "atom.xml"), atomXml);
      writeFileEnsureDir(path.join(DIST_DIR, "feed.json"), JSON.stringify(jsonFeed, null, 2));
    }
    writeFileEnsureDir(path.join(DIST_DIR, "rss", `${ch.slug}.xml`), rssXml);
    writeFileEnsureDir(path.join(DIST_DIR, "atom", `${ch.slug}.xml`), atomXml);
    writeFileEnsureDir(
      path.join(DIST_DIR, "feed", `${ch.slug}.json`),
      JSON.stringify(jsonFeed, null, 2)
    );

    writeFileEnsureDir(
      path.join(DIST_DIR, "api", "articles", `${ch.slug}.json`),
      JSON.stringify({
        channel: feed.channel,
        fetchedAt: feed.fetchedAt,
        fromCache: false,
        total: feed.items.length,
        items: feed.items,
      })
    );
    console.log(`  - ${ch.slug}: ${feed.items.length} articles`);
  }

  // Daily digest feeds
  const daily = await getDailyEditionsFeed();
  writeFileEnsureDir(
    path.join(DIST_DIR, "rss", "daily.xml"),
    buildDailyRssXml(daily, SITE_URL, "/rss/daily.xml", true)
  );
  writeFileEnsureDir(
    path.join(DIST_DIR, "atom", "daily.xml"),
    buildDailyAtomXml(daily, SITE_URL, "/atom/daily.xml", true)
  );
  writeFileEnsureDir(
    path.join(DIST_DIR, "feed", "daily.json"),
    JSON.stringify(buildDailyJsonFeed(daily, SITE_URL, "/feed/daily.json", true), null, 2)
  );
  writeFileEnsureDir(
    path.join(DIST_DIR, "api", "daily.json"),
    JSON.stringify({
      fetchedAt: daily.fetchedAt,
      fromCache: false,
      totalEditions: daily.editions.length,
      editions: daily.editions,
    })
  );
  console.log(`  - daily: ${daily.editions.length} editions`);

  // OPML bundle
  const opml = buildOpmlXml(SITE_URL);
  writeFileEnsureDir(path.join(DIST_DIR, "people-sx.opml"), opml);

  console.log("Static RSS/Atom/JSON/OPML build completed.");
}

main().catch((err) => {
  console.error("Failed to build static feeds:", err);
  process.exit(1);
});
