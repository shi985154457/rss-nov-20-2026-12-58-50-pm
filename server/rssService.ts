import { load } from "cheerio";

export interface ChannelDefinition {
  slug: string;
  name: string;
  description: string;
  sourceUrl: string;
}

export interface ArticleItem {
  id: string;
  title: string;
  link: string;
  channelSlug: string;
  channelName: string;
  source: string;
  editor: string;
  publishedAt: string; // ISO 8601
  pubDateDisplay: string; // e.g. 2026-11-20 10:36
  dateKey: string; // e.g. 2026-11-20 (Asia/Shanghai)
  summary: string;
  paragraphs: string[];
  images: string[];
}

export interface DailyEdition {
  date: string; // YYYY-MM-DD
  dateDisplay: string; // YYYY年M月D日
  weekday: string; // 星期X
  editionTitle: string;
  link: string;
  publishedAt: string; // ISO 8601
  articleCount: number;
  channelsCovered: string[];
  leadImage?: string;
  summary: string;
  articles: ArticleItem[];
}

export interface ChannelFeedResult {
  channel: ChannelDefinition;
  items: ArticleItem[];
  fetchedAt: string;
  fromCache: boolean;
}

export interface DailyEditionsResult {
  editions: DailyEdition[];
  fetchedAt: string;
  fromCache: boolean;
}

export const CHANNELS: ChannelDefinition[] = [
  {
    slug: "all",
    name: "全部新闻",
    description: "聚合人民网山西频道首页及各专题栏目的最新权威新闻",
    sourceUrl: "http://sx.people.com.cn/",
  },
  {
    slug: "yaowen",
    name: "山西要闻",
    description: "山西省重要时政动态、省委省政府决策部署与全省要闻",
    sourceUrl: "http://sx.people.com.cn/GB/189130/index.html",
  },
  {
    slug: "yuanchuang",
    name: "本网原创",
    description: "人民网山西频道记者一线采写的深度报道与原创专题",
    sourceUrl: "http://sx.people.com.cn/GB/189132/index.html",
  },
  {
    slug: "jingji",
    name: "产业经济",
    description: "能源转型、制造业集群、消费提振与营商环境报道",
    sourceUrl: "http://sx.people.com.cn/GB/189150/index.html",
  },
  {
    slug: "minsheng",
    name: "社会民生",
    description: "就业养老、市政交通、社会治理与百姓生活关注",
    sourceUrl: "http://sx.people.com.cn/GB/189147/index.html",
  },
  {
    slug: "wenlv",
    name: "文化旅游",
    description: "三晋文脉、非遗传承、古建保护与文旅融合动态",
    sourceUrl: "http://sx.people.com.cn/GB/189153/index.html",
  },
  {
    slug: "xiangcun",
    name: "乡村振兴",
    description: "三农发展、特优农业与和美乡村建设一线纪实",
    sourceUrl: "http://sx.people.com.cn/GB/189154/index.html",
  },
  {
    slug: "kejiao",
    name: "教育科技",
    description: "科研创新、高等教育、基础教育与人才培养报道",
    sourceUrl: "http://sx.people.com.cn/GB/352650/index.html",
  },
  {
    slug: "jiankang",
    name: "卫生健康",
    description: "医疗卫生服务、健康山西建设与中医药发展",
    sourceUrl: "http://sx.people.com.cn/GB/352662/index.html",
  },
  {
    slug: "dishi",
    name: "地市动态",
    description: "太原、大同、长治、运城等山西各地市高质量发展动态",
    sourceUrl: "http://sx.people.com.cn/GB/189133/index.html",
  },
  {
    slug: "dangjian",
    name: "党建政务",
    description: "基层党建、党风廉政与机关作风建设报道",
    sourceUrl: "http://sx.people.com.cn/GB/353622/index.html",
  },
  {
    slug: "rmrb",
    name: "人民日报看山西",
    description: "《人民日报》刊发关注山西发展与改革成果的重要报道",
    sourceUrl: "http://sx.people.com.cn/GB/189721/index.html",
  },
];

const ARTICLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CHANNEL_CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

const articleCache = new Map<string, { item: ArticleItem | null; expiresAt: number }>();
const channelCache = new Map<string, { result: ChannelFeedResult; expiresAt: number }>();
const inflightChannelRequests = new Map<string, Promise<ChannelFeedResult>>();

export function getChannelBySlug(slug: string): ChannelDefinition | undefined {
  return CHANNELS.find((ch) => ch.slug === slug);
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseChinaTime(
  rawTime: string,
  fallbackDate: string
): { iso: string; display: string; dateKey: string } {
  const match = rawTime.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/);
  if (match) {
    const [, y, m, d, hh, mm] = match;
    const pad = (v: string) => v.padStart(2, "0");
    const dateKey = `${y}-${pad(m)}-${pad(d)}`;
    const iso = `${dateKey}T${pad(hh)}:${pad(mm)}:00+08:00`;
    const display = `${dateKey} ${pad(hh)}:${pad(mm)}`;
    return { iso, display, dateKey };
  }
  const dateOnly = fallbackDate.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const dateKey = `${y}-${m}-${d}`;
    return {
      iso: `${dateKey}T08:00:00+08:00`,
      display: `${dateKey} 08:00`,
      dateKey,
    };
  }
  const now = new Date();
  const cnDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return {
    iso: now.toISOString(),
    display: `${cnDate} 08:00`,
    dateKey: cnDate,
  };
}

function formatChineseDateAndWeekday(dateKey: string): { dateDisplay: string; weekday: string } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0));
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const weekday = weekdays[dt.getUTCDay()] ?? "";
  return {
    dateDisplay: `${y}年${m}月${d}日`,
    weekday,
  };
}

function normalizeUrl(href: string, base = "http://sx.people.com.cn"): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  if (href.startsWith("/")) {
    return `${base}${href}`;
  }
  return `${base}/${href}`;
}

function cleanSourceName(metaSource: string, bylineSource: string): string {
  const raw = metaSource || bylineSource;
  const fromMatch = raw.match(/来源[：:]\s*([^\s|]+)/);
  let cleaned = fromMatch ? fromMatch[1] : raw;
  cleaned = cleaned
    .replace(/^来源[：:]\s*/, "")
    .replace(/\s*原创稿$/, "")
    .trim();
  if (!cleaned || cleaned.includes("年") || cleaned.length > 30) {
    return "人民网山西频道";
  }
  return cleaned;
}

function isRealArticleImage(src: string | undefined): src is string {
  if (!src) return false;
  const lower = src.toLowerCase();
  if (
    lower.includes("share.png") ||
    lower.includes("/img/2020wbc/") ||
    lower.includes("icon") ||
    lower.includes("logo") ||
    lower.includes("erweima") ||
    lower.includes("qrcode") ||
    lower.endsWith(".gif")
  ) {
    return false;
  }
  return (
    lower.includes("/nmediafile/") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  );
}

async function fetchAndParseArticle(
  link: string,
  channel: ChannelDefinition
): Promise<ArticleItem | null> {
  const cached = articleCache.get(link);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.item) return null;
    return {
      ...cached.item,
      channelSlug: channel.slug === "all" ? cached.item.channelSlug : channel.slug,
      channelName: channel.slug === "all" ? cached.item.channelName : channel.name,
    };
  }

  try {
    const html = await fetchWithTimeout(link, 7500);
    const $ = load(html);

    const title =
      $("h1")
        .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
        .get()
        .find((t) => t.length > 0) ||
      $("title").text().replace(/--.*$/, "").trim();

    if (!title) {
      articleCache.set(link, { item: null, expiresAt: Date.now() + ARTICLE_CACHE_TTL_MS });
      return null;
    }

    const metaSource = $('meta[name="source"]').attr("content")?.trim() ?? "";
    const bylineSource = $(".col-1-1").text().trim() || $(".box01").text().trim();
    const source = cleanSourceName(metaSource, bylineSource);

    const rawTime = $("#newstime").text().trim() || bylineSource;
    const fallbackDate = $('meta[name="publishdate"]').attr("content")?.trim() ?? "";
    const { iso, display, dateKey } = parseChinaTime(rawTime, fallbackDate);

    const paragraphs = $(".rm_txt_con p")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(
        (p) =>
          p.length > 0 &&
          !p.includes("分享让更多人看到") &&
          !p.startsWith("(责编：") &&
          !p.startsWith("（责编：")
      );

    const metaDesc = $('meta[name="description"]').attr("content")?.replace(/\s+/g, " ").trim() ?? "";
    const summary = metaDesc || paragraphs[0] || title;

    const images = Array.from(
      new Set(
        $(".rm_txt_con img")
          .map((_, el) => $(el).attr("src"))
          .get()
          .filter(isRealArticleImage)
          .map((img) => normalizeUrl(img))
      )
    );

    const editor = $(".edit").text().replace(/[()（）]/g, "").trim();
    const idMatch = link.match(/(\d+-\d+)\.html$/);
    const id = idMatch ? idMatch[1] : Buffer.from(link).toString("base64url").slice(0, 16);

    const item: ArticleItem = {
      id,
      title,
      link,
      channelSlug: channel.slug,
      channelName: channel.name,
      source,
      editor,
      publishedAt: iso,
      pubDateDisplay: display,
      dateKey,
      summary,
      paragraphs: paragraphs.length > 0 ? paragraphs : [summary],
      images,
    };

    articleCache.set(link, { item, expiresAt: Date.now() + ARTICLE_CACHE_TTL_MS });
    return item;
  } catch {
    return null;
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function next() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

async function scrapeChannelLinks(sourceUrl: string, maxLinks = 40): Promise<string[]> {
  const html = await fetchWithTimeout(sourceUrl, 8000);
  const $ = load(html);
  const links: string[] = [];
  const seen = new Set<string>();

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (!/\/n2\/202\d\/\d{4}\/c\d+-\d+\.html/.test(href)) return;
    const full = normalizeUrl(href);
    if (!seen.has(full)) {
      seen.add(full);
      links.push(full);
    }
  });

  return links.slice(0, maxLinks);
}

async function fetchSingleChannel(channel: ChannelDefinition, maxLinks = 40): Promise<ArticleItem[]> {
  const links = await scrapeChannelLinks(channel.sourceUrl, maxLinks);
  const parsed = await runWithConcurrency(links, 10, (link) =>
    fetchAndParseArticle(link, channel)
  );
  const valid = parsed.filter((x): x is ArticleItem => x !== null);
  valid.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return valid;
}

export async function getChannelFeed(
  channelSlug = "all",
  options: { forceRefresh?: boolean; query?: string; limit?: number } = {}
): Promise<ChannelFeedResult> {
  const channel = getChannelBySlug(channelSlug) ?? CHANNELS[0];
  const now = Date.now();

  let baseResult: ChannelFeedResult | undefined;

  if (!options.forceRefresh) {
    const cached = channelCache.get(channel.slug);
    if (cached && cached.expiresAt > now) {
      baseResult = { ...cached.result, fromCache: true };
    }
  }

  if (!baseResult) {
    const inflight = inflightChannelRequests.get(channel.slug);
    if (inflight && !options.forceRefresh) {
      baseResult = await inflight;
    } else {
      const promise = (async (): Promise<ChannelFeedResult> => {
        try {
          let items: ArticleItem[] = [];
          if (channel.slug === "all") {
            const subChannels = CHANNELS.filter((c) => c.slug !== "all");
            const [homepageItems, ...perChannelLists] = await Promise.all([
              fetchSingleChannel(
                {
                  slug: "yaowen",
                  name: "首页要闻",
                  description: channel.description,
                  sourceUrl: "http://sx.people.com.cn/",
                },
                30
              ).catch(() => [] as ArticleItem[]),
              ...subChannels.map((sub) =>
                fetchSingleChannel(sub, 20).catch(() => [] as ArticleItem[])
              ),
            ]);

            const dedup = new Map<string, ArticleItem>();
            for (const list of perChannelLists) {
              for (const item of list) {
                if (!dedup.has(item.link)) {
                  dedup.set(item.link, item);
                }
              }
            }
            for (const item of homepageItems) {
              if (!dedup.has(item.link)) {
                dedup.set(item.link, item);
              }
            }
            items = Array.from(dedup.values()).sort(
              (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
            );
          } else {
            items = await fetchSingleChannel(channel, 40);
          }

          const result: ChannelFeedResult = {
            channel,
            items,
            fetchedAt: new Date().toISOString(),
            fromCache: false,
          };
          channelCache.set(channel.slug, {
            result,
            expiresAt: Date.now() + CHANNEL_CACHE_TTL_MS,
          });
          return result;
        } catch (err) {
          const stale = channelCache.get(channel.slug);
          if (stale) {
            return { ...stale.result, fromCache: true };
          }
          throw err;
        } finally {
          inflightChannelRequests.delete(channel.slug);
        }
      })();

      inflightChannelRequests.set(channel.slug, promise);
      baseResult = await promise;
    }
  }

  let filteredItems = baseResult.items;
  const q = options.query?.trim().toLowerCase();
  if (q) {
    filteredItems = filteredItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.channelName.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
    );
  }

  if (options.limit && options.limit > 0) {
    filteredItems = filteredItems.slice(0, options.limit);
  }

  return {
    ...baseResult,
    items: filteredItems,
  };
}

export async function getDailyEditionsFeed(
  options: { forceRefresh?: boolean; query?: string; limit?: number } = {}
): Promise<DailyEditionsResult> {
  const feed = await getChannelFeed("all", {
    forceRefresh: options.forceRefresh,
    query: options.query,
  });

  const grouped = new Map<string, ArticleItem[]>();
  for (const item of feed.items) {
    const key = item.dateKey || item.pubDateDisplay.slice(0, 10);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  const channelPriority = new Map<string, number>(
    CHANNELS.map((c, idx) => [c.slug, idx])
  );

  let editions: DailyEdition[] = Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, dayItems]) => {
      const sorted = [...dayItems].sort((a, b) => {
        const pa = channelPriority.get(a.channelSlug) ?? 99;
        const pb = channelPriority.get(b.channelSlug) ?? 99;
        if (pa !== pb) return pa - pb;
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      });

      const { dateDisplay, weekday } = formatChineseDateAndWeekday(date);
      const channelsCovered = Array.from(new Set(sorted.map((a) => a.channelName)));
      const leadImage = sorted.find((a) => a.images.length > 0)?.images[0];
      const latestPublishedAt = sorted.reduce(
        (latest, cur) => (Date.parse(cur.publishedAt) > Date.parse(latest) ? cur.publishedAt : latest),
        sorted[0].publishedAt
      );

      const headlinesPreview = sorted
        .slice(0, 4)
        .map((a) => `《${a.title}》`)
        .join("、");
      const summary = `人民网山西频道 ${dateDisplay}（${weekday}）共发布 ${sorted.length} 篇报道，涵盖${channelsCovered.join("、")}。重点报道：${headlinesPreview}${sorted.length > 4 ? " 等。" : "。"}`;

      return {
        date,
        dateDisplay,
        weekday,
        editionTitle: `人民网山西频道 · ${dateDisplay}每日新闻汇总（${sorted.length}篇）`,
        link: sorted[0].link,
        publishedAt: latestPublishedAt,
        articleCount: sorted.length,
        channelsCovered,
        leadImage,
        summary,
        articles: sorted,
      };
    });

  if (options.limit && options.limit > 0) {
    editions = editions.slice(0, options.limit);
  }

  return {
    editions,
    fetchedAt: feed.fetchedAt,
    fromCache: feed.fromCache,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveImageUrl(img: string, baseUrl: string, staticMode: boolean): string {
  return staticMode ? img : `${baseUrl}/api/image?url=${encodeURIComponent(img)}`;
}

function formatArticleHtml(item: ArticleItem, baseUrl: string, staticMode = false): string {
  const imgTags = item.images
    .map((img) => {
      const src = resolveImageUrl(img, baseUrl, staticMode);
      return `<p><img src="${escapeXml(src)}" alt="${escapeXml(item.title)}" style="max-width:100%;height:auto;" /></p>`;
    })
    .join("\n");

  const bodyParas = item.paragraphs
    .map((p) => `<p>${escapeXml(p)}</p>`)
    .join("\n");

  const footer = `<p><small>来源：${escapeXml(item.source)} · 栏目：${escapeXml(item.channelName)}${
    item.editor ? ` · ${escapeXml(item.editor)}` : ""
  }</small></p>`;

  return `${imgTags}\n${bodyParas}\n${footer}`;
}

function formatDailyEditionHtml(edition: DailyEdition, baseUrl: string, staticMode = false): string {
  const tocItems = edition.articles
    .map(
      (art) =>
        `<li><strong>[${escapeXml(art.channelName)}]</strong> ${escapeXml(art.title)} <small>(${escapeXml(art.source)} · ${escapeXml(art.pubDateDisplay)})</small></li>`
    )
    .join("\n");

  const articlesHtml = edition.articles
    .map((art, i) => {
      const imgs = art.images
        .map((img) => {
          const src = resolveImageUrl(img, baseUrl, staticMode);
          return `<p><img src="${escapeXml(src)}" alt="${escapeXml(art.title)}" style="max-width:100%;height:auto;" /></p>`;
        })
        .join("\n");
      const paras = art.paragraphs.map((p) => `<p>${escapeXml(p)}</p>`).join("\n");
      return `<hr />
<h2>${i + 1}. ${escapeXml(art.title)}</h2>
<p><small>栏目：${escapeXml(art.channelName)} · 来源：${escapeXml(art.source)} · 时间：${escapeXml(art.pubDateDisplay)} · <a href="${escapeXml(art.link)}">原文链接</a></small></p>
${imgs}
${paras}`;
    })
    .join("\n");

  return `<p><strong>人民网山西频道每日新闻汇总 · ${escapeXml(edition.dateDisplay)}（${escapeXml(edition.weekday)}）</strong></p>
<p>当日共收录 ${edition.articleCount} 篇报道，涵盖：${escapeXml(edition.channelsCovered.join("、"))}。</p>
<h3>当日导读目录</h3>
<ol>
${tocItems}
</ol>
${articlesHtml}`;
}

export function buildRssXml(
  feed: ChannelFeedResult,
  baseUrl: string,
  selfPath: string,
  staticMode = false
): string {
  const channelTitle =
    feed.channel.slug === "all"
      ? "人民网山西频道 RSS — 全部新闻"
      : `人民网山西频道 RSS — ${feed.channel.name}`;
  const selfUrl = `${baseUrl}${selfPath}`;
  const lastBuildDate = new Date(feed.fetchedAt).toUTCString();

  const itemsXml = feed.items
    .map((item) => {
      const pubDate = new Date(item.publishedAt).toUTCString();
      const htmlContent = formatArticleHtml(item, baseUrl, staticMode);
      const leadImage = item.images[0]
        ? resolveImageUrl(item.images[0], baseUrl, staticMode)
        : null;

      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(item.source)}</dc:creator>
      <category>${escapeXml(item.channelName)}</category>
      <description><![CDATA[${item.summary}]]></description>
      <content:encoded><![CDATA[${htmlContent}]]></content:encoded>${
        leadImage
          ? `\n      <enclosure url="${escapeXml(leadImage)}" length="0" type="image/jpeg" />`
          : ""
      }
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(feed.channel.sourceUrl)}</link>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(feed.channel.description)}</description>
    <language>zh-CN</language>
    <copyright>人民网山西频道 sx.people.com.cn</copyright>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>15</ttl>
${itemsXml}
  </channel>
</rss>`;
}

export function buildDailyRssXml(
  result: DailyEditionsResult,
  baseUrl: string,
  selfPath: string,
  staticMode = false
): string {
  const selfUrl = `${baseUrl}${selfPath}`;
  const lastBuildDate = new Date(result.fetchedAt).toUTCString();

  const itemsXml = result.editions
    .map((edition) => {
      const pubDate = new Date(edition.publishedAt).toUTCString();
      const htmlContent = formatDailyEditionHtml(edition, baseUrl, staticMode);
      const leadImage = edition.leadImage
        ? resolveImageUrl(edition.leadImage, baseUrl, staticMode)
        : null;

      return `    <item>
      <title>${escapeXml(edition.editionTitle)}</title>
      <link>${escapeXml(edition.link)}</link>
      <guid isPermaLink="false">people-sx-daily-${escapeXml(edition.date)}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>人民网山西频道</dc:creator>
      <category>每日新闻汇总</category>
      <description><![CDATA[${edition.summary}]]></description>
      <content:encoded><![CDATA[${htmlContent}]]></content:encoded>${
        leadImage
          ? `\n      <enclosure url="${escapeXml(leadImage)}" length="0" type="image/jpeg" />`
          : ""
      }
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>人民网山西频道 RSS — 每日新闻汇总</title>
    <link>http://sx.people.com.cn/</link>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>按日汇总人民网山西频道全部报道，每天一期推送当日新闻导读与全文</description>
    <language>zh-CN</language>
    <copyright>人民网山西频道 sx.people.com.cn</copyright>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>30</ttl>
${itemsXml}
  </channel>
</rss>`;
}

export function buildAtomXml(
  feed: ChannelFeedResult,
  baseUrl: string,
  selfPath: string,
  staticMode = false
): string {
  const channelTitle =
    feed.channel.slug === "all"
      ? "人民网山西频道 Atom — 全部新闻"
      : `人民网山西频道 Atom — ${feed.channel.name}`;
  const selfUrl = `${baseUrl}${selfPath}`;
  const updated = new Date(feed.fetchedAt).toISOString();

  const entriesXml = feed.items
    .map((item) => {
      const htmlContent = formatArticleHtml(item, baseUrl, staticMode);
      return `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.link)}" rel="alternate" type="text/html" />
    <id>${escapeXml(item.link)}</id>
    <updated>${new Date(item.publishedAt).toISOString()}</updated>
    <published>${new Date(item.publishedAt).toISOString()}</published>
    <author>
      <name>${escapeXml(item.source)}</name>
    </author>
    <category term="${escapeXml(item.channelName)}" />
    <summary type="text">${escapeXml(item.summary)}</summary>
    <content type="html"><![CDATA[${htmlContent}]]></content>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(channelTitle)}</title>
  <subtitle>${escapeXml(feed.channel.description)}</subtitle>
  <link href="${escapeXml(selfUrl)}" rel="self" type="application/atom+xml" />
  <link href="${escapeXml(feed.channel.sourceUrl)}" rel="alternate" type="text/html" />
  <id>${escapeXml(selfUrl)}</id>
  <updated>${updated}</updated>
${entriesXml}
</feed>`;
}

export function buildDailyAtomXml(
  result: DailyEditionsResult,
  baseUrl: string,
  selfPath: string,
  staticMode = false
): string {
  const selfUrl = `${baseUrl}${selfPath}`;
  const updated = new Date(result.fetchedAt).toISOString();

  const entriesXml = result.editions
    .map((edition) => {
      const htmlContent = formatDailyEditionHtml(edition, baseUrl, staticMode);
      const iso = new Date(edition.publishedAt).toISOString();
      return `  <entry>
    <title>${escapeXml(edition.editionTitle)}</title>
    <link href="${escapeXml(edition.link)}" rel="alternate" type="text/html" />
    <id>urn:people-sx:daily:${escapeXml(edition.date)}</id>
    <updated>${iso}</updated>
    <published>${iso}</published>
    <author>
      <name>人民网山西频道</name>
    </author>
    <category term="每日新闻汇总" />
    <summary type="text">${escapeXml(edition.summary)}</summary>
    <content type="html"><![CDATA[${htmlContent}]]></content>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>人民网山西频道 Atom — 每日新闻汇总</title>
  <subtitle>按日汇总人民网山西频道全部报道，每天一期推送当日新闻导读与全文</subtitle>
  <link href="${escapeXml(selfUrl)}" rel="self" type="application/atom+xml" />
  <link href="http://sx.people.com.cn/" rel="alternate" type="text/html" />
  <id>${escapeXml(selfUrl)}</id>
  <updated>${updated}</updated>
${entriesXml}
</feed>`;
}

export function buildJsonFeed(
  feed: ChannelFeedResult,
  baseUrl: string,
  selfPath: string,
  staticMode = false
) {
  const title =
    feed.channel.slug === "all"
      ? "人民网山西频道 JSON Feed — 全部新闻"
      : `人民网山西频道 JSON Feed — ${feed.channel.name}`;

  return {
    version: "https://jsonfeed.org/version/1.1",
    title,
    home_page_url: feed.channel.sourceUrl,
    feed_url: `${baseUrl}${selfPath}`,
    description: feed.channel.description,
    language: "zh-CN",
    items: feed.items.map((item) => ({
      id: item.link,
      url: item.link,
      title: item.title,
      summary: item.summary,
      content_html: formatArticleHtml(item, baseUrl, staticMode),
      content_text: item.paragraphs.join("\n\n"),
      date_published: item.publishedAt,
      authors: [{ name: item.source }],
      tags: [item.channelName, item.source],
      image: item.images[0]
        ? resolveImageUrl(item.images[0], baseUrl, staticMode)
        : undefined,
    })),
  };
}

export function buildDailyJsonFeed(
  result: DailyEditionsResult,
  baseUrl: string,
  selfPath: string,
  staticMode = false
) {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: "人民网山西频道 JSON Feed — 每日新闻汇总",
    home_page_url: "http://sx.people.com.cn/",
    feed_url: `${baseUrl}${selfPath}`,
    description: "按日汇总人民网山西频道全部报道，每天一期推送当日新闻导读与全文",
    language: "zh-CN",
    items: result.editions.map((edition) => ({
      id: `people-sx-daily-${edition.date}`,
      url: edition.link,
      title: edition.editionTitle,
      summary: edition.summary,
      content_html: formatDailyEditionHtml(edition, baseUrl, staticMode),
      content_text: edition.articles
        .map((a, idx) => `${idx + 1}. [${a.channelName}] ${a.title}\n${a.paragraphs.join("\n")}`)
        .join("\n\n---\n\n"),
      date_published: edition.publishedAt,
      authors: [{ name: "人民网山西频道" }],
      tags: ["每日新闻汇总", ...edition.channelsCovered],
      image: edition.leadImage
        ? resolveImageUrl(edition.leadImage, baseUrl, staticMode)
        : undefined,
    })),
  };
}

export function buildOpmlXml(baseUrl: string): string {
  const dailyOutline = `      <outline type="rss" text="人民网山西频道 · 每日新闻汇总" title="人民网山西频道 · 每日新闻汇总" xmlUrl="${escapeXml(
    `${baseUrl}/rss/daily.xml`
  )}" htmlUrl="http://sx.people.com.cn/" />`;

  const outlines = CHANNELS.map((ch) => {
    const title = ch.slug === "all" ? "人民网山西频道 · 全部新闻" : `人民网山西频道 · ${ch.name}`;
    const xmlUrl = ch.slug === "all" ? `${baseUrl}/rss.xml` : `${baseUrl}/rss/${ch.slug}.xml`;
    return `      <outline type="rss" text="${escapeXml(title)}" title="${escapeXml(
      title
    )}" xmlUrl="${escapeXml(xmlUrl)}" htmlUrl="${escapeXml(ch.sourceUrl)}" />`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>人民网山西频道分栏与每日汇总 RSS 订阅合集</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    <outline text="人民网山西频道" title="人民网山西频道">
${dailyOutline}
${outlines}
    </outline>
  </body>
</opml>`;
}
