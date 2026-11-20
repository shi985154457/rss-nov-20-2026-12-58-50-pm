import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  CHANNELS,
  buildAtomXml,
  buildDailyAtomXml,
  buildDailyJsonFeed,
  buildDailyRssXml,
  buildJsonFeed,
  buildOpmlXml,
  buildRssXml,
  getChannelBySlug,
  getChannelFeed,
  getDailyEditionsFeed,
} from "./server/rssService.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

function resolveBaseUrl(req: Request): string {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ||
    req.protocol ||
    "http";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() ||
    req.get("host") ||
    `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function parseQueryOptions(req: Request) {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const limit = limitRaw && Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : undefined;
  const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
  return { query: q, limit, forceRefresh };
}

async function createApp() {
  const app = express();
  app.set("trust proxy", true);

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, channels: CHANNELS.length });
  });

  app.get("/api/channels", (_req: Request, res: Response) => {
    res.json({ channels: CHANNELS });
  });

  app.get("/api/articles", async (req: Request, res: Response) => {
    const channelSlug = typeof req.query.channel === "string" ? req.query.channel : "all";
    if (!getChannelBySlug(channelSlug)) {
      res.status(404).json({ error: "未找到指定的报道版块" });
      return;
    }
    try {
      const opts = parseQueryOptions(req);
      const feed = await getChannelFeed(channelSlug, opts);
      res.json({
        channel: feed.channel,
        fetchedAt: feed.fetchedAt,
        fromCache: feed.fromCache,
        total: feed.items.length,
        items: feed.items,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "抓取山西日报源数据时发生网络异常";
      res.status(502).json({ error: message });
    }
  });

  app.get("/api/daily", async (req: Request, res: Response) => {
    try {
      const opts = parseQueryOptions(req);
      const daily = await getDailyEditionsFeed(opts);
      res.json({
        fetchedAt: daily.fetchedAt,
        fromCache: daily.fromCache,
        totalEditions: daily.editions.length,
        editions: daily.editions,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "抓取山西日报每日合刊数据时发生网络异常";
      res.status(502).json({ error: message });
    }
  });

  app.get("/api/image", async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).send("Invalid URL");
      return;
    }

    const allowedHosts = new Set([
      "sx.people.com.cn",
      "www.people.com.cn",
      "paper.people.com.cn",
      "epaper.sxrb.com",
    ]);
    if (!allowedHosts.has(parsed.hostname)) {
      res.status(403).send("Host not allowed");
      return;
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "http://sx.people.com.cn/",
        },
      });
      if (!upstream.ok) {
        res.status(upstream.status).send("Upstream image unavailable");
        return;
      }
      const contentType = upstream.headers.get("content-type") || "image/jpeg";
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buf);
    } catch {
      res.status(502).send("Image proxy failed");
    }
  });

  // Standard RSS 2.0 endpoints
  const handleRss = async (req: Request, res: Response, channelSlug: string) => {
    const opts = parseQueryOptions(req);
    const baseUrl = resolveBaseUrl(req);
    if (channelSlug === "daily") {
      try {
        const daily = await getDailyEditionsFeed(opts);
        const xml = buildDailyRssXml(daily, baseUrl, req.originalUrl);
        res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.send(xml);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "每日合刊 RSS 生成失败";
        res.status(502).type("text/plain; charset=utf-8").send(msg);
      }
      return;
    }
    if (!getChannelBySlug(channelSlug)) {
      res.status(404).type("text/plain; charset=utf-8").send("未找到指定的 RSS 频道");
      return;
    }
    try {
      const feed = await getChannelFeed(channelSlug, opts);
      const xml = buildRssXml(feed, baseUrl, req.originalUrl);
      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(xml);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RSS 生成失败";
      res.status(502).type("text/plain; charset=utf-8").send(msg);
    }
  };

  app.get("/rss.xml", (req: Request, res: Response) => handleRss(req, res, "all"));
  app.get("/rss/:channel.xml", (req: Request, res: Response) =>
    handleRss(req, res, String(req.params.channel))
  );

  // Atom 1.0 endpoints
  const handleAtom = async (req: Request, res: Response, channelSlug: string) => {
    const opts = parseQueryOptions(req);
    const baseUrl = resolveBaseUrl(req);
    if (channelSlug === "daily") {
      try {
        const daily = await getDailyEditionsFeed(opts);
        const xml = buildDailyAtomXml(daily, baseUrl, req.originalUrl);
        res.setHeader("Content-Type", "application/atom+xml; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.send(xml);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "每日合刊 Atom 生成失败";
        res.status(502).type("text/plain; charset=utf-8").send(msg);
      }
      return;
    }
    if (!getChannelBySlug(channelSlug)) {
      res.status(404).type("text/plain; charset=utf-8").send("未找到指定的 Atom 频道");
      return;
    }
    try {
      const feed = await getChannelFeed(channelSlug, opts);
      const xml = buildAtomXml(feed, baseUrl, req.originalUrl);
      res.setHeader("Content-Type", "application/atom+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(xml);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Atom 生成失败";
      res.status(502).type("text/plain; charset=utf-8").send(msg);
    }
  };

  app.get("/atom.xml", (req: Request, res: Response) => handleAtom(req, res, "all"));
  app.get("/atom/:channel.xml", (req: Request, res: Response) =>
    handleAtom(req, res, String(req.params.channel))
  );

  // JSON Feed 1.1 endpoints
  const handleJsonFeed = async (req: Request, res: Response, channelSlug: string) => {
    const opts = parseQueryOptions(req);
    const baseUrl = resolveBaseUrl(req);
    if (channelSlug === "daily") {
      try {
        const daily = await getDailyEditionsFeed(opts);
        const payload = buildDailyJsonFeed(daily, baseUrl, req.originalUrl);
        res.setHeader("Content-Type", "application/feed+json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.json(payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "每日合刊 JSON Feed 生成失败";
        res.status(502).json({ error: msg });
      }
      return;
    }
    if (!getChannelBySlug(channelSlug)) {
      res.status(404).json({ error: "未找到指定的 JSON Feed 频道" });
      return;
    }
    try {
      const feed = await getChannelFeed(channelSlug, opts);
      const payload = buildJsonFeed(feed, baseUrl, req.originalUrl);
      res.setHeader("Content-Type", "application/feed+json; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "JSON Feed 生成失败";
      res.status(502).json({ error: msg });
    }
  };

  app.get("/feed.json", (req: Request, res: Response) => handleJsonFeed(req, res, "all"));
  app.get("/feed/:channel.json", (req: Request, res: Response) =>
    handleJsonFeed(req, res, String(req.params.channel))
  );

  // OPML 2.0 bundle export
  const handleOpml = (req: Request, res: Response, filename: string) => {
    const baseUrl = resolveBaseUrl(req);
    const opml = buildOpmlXml(baseUrl);
    res.setHeader("Content-Type", "text/x-opml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(opml);
  };
  app.get("/people-sx.opml", (req: Request, res: Response) => handleOpml(req, res, "people-sx.opml"));
  app.get("/shanxi-daily.opml", (req: Request, res: Response) => handleOpml(req, res, "people-sx.opml"));

  const httpServer = http.createServer(app);

  if (!isProduction) {
    const disableHmr = process.env.DISABLE_HMR === "true";

    if (disableHmr) {
      const viteClientStub = `
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
  }
  sheetsMap.delete(id);
}
export function createHotContext() {
  return {
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
    data: {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay extends HTMLElement {}
`;
      app.get("/@vite/client", (_req: Request, res: Response) => {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.send(viteClientStub);
      });
    }

    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build artifacts missing");
      }
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`People.cn Shanxi RSS server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp();
