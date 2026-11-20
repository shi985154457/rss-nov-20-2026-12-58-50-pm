import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Rss,
  Search,
  X,
} from "lucide-react";
import { ArticleModal } from "./components/ArticleModal";
import { DailyEditionModal } from "./components/DailyEditionModal";
import { FeedImage } from "./components/FeedImage";
import type {
  ArticleItem,
  ArticlesApiResponse,
  ChannelDefinition,
  DailyApiResponse,
  DailyEdition,
  FeedFormat,
  SubscriptionMode,
} from "./types/feed";

const DEFAULT_CHANNELS: ChannelDefinition[] = [
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

function formatChinaCalendarDate(): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date());
  } catch {
    return "今日新闻";
  }
}

export default function App() {
  const [channels, setChannels] = useState<ChannelDefinition[]>(DEFAULT_CHANNELS);
  const [subscriptionMode, setSubscriptionMode] = useState<SubscriptionMode>("channels");
  const [activeChannel, setActiveChannel] = useState<string>("all");
  const [feedFormat, setFeedFormat] = useState<FeedFormat>("rss");
  const [queryInput, setQueryInput] = useState<string>("");
  const [appliedQuery, setAppliedQuery] = useState<string>("");

  const [editions, setEditions] = useState<DailyEdition[]>([]);
  const [selectedEditionDate, setSelectedEditionDate] = useState<string>("");
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [xmlSource, setXmlSource] = useState<string>("");
  const [xmlLoading, setXmlLoading] = useState<boolean>(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);
  const [viewingFullEdition, setViewingFullEdition] = useState<DailyEdition | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

  const feedRelativePath = useMemo(() => {
    const slug = subscriptionMode === "daily" ? "daily" : activeChannel;
    const base =
      feedFormat === "rss"
        ? slug === "all"
          ? "/rss.xml"
          : `/rss/${slug}.xml`
        : feedFormat === "atom"
        ? slug === "all"
          ? "/atom.xml"
          : `/atom/${slug}.xml`
        : slug === "all"
        ? "/feed.json"
        : `/feed/${slug}.json`;

    const params = new URLSearchParams();
    if (appliedQuery.trim()) {
      params.set("q", appliedQuery.trim());
    }
    const qs = params.toString();
    return `${basePath}${qs ? `${base}?${qs}` : base}`;
  }, [subscriptionMode, activeChannel, feedFormat, appliedQuery, basePath]);

  const fullFeedUrl = `${origin}${feedRelativePath}`;

  const currentChannelObj = useMemo(
    () => channels.find((c) => c.slug === activeChannel) ?? channels[0],
    [channels, activeChannel]
  );

  const activeEdition = useMemo(() => {
    if (editions.length === 0) return null;
    return editions.find((ed) => ed.date === selectedEditionDate) ?? editions[0];
  }, [editions, selectedEditionDate]);

  useEffect(() => {
    fetch(`${basePath}/api/channels`)
      .then((r) => (r.ok ? r.json() : fetch(`${basePath}/api/channels.json`).then((sr) => (sr.ok ? sr.json() : null))))
      .then((data) => {
        if (data?.channels?.length) {
          setChannels(data.channels);
        }
      })
      .catch(() => {});
  }, [basePath]);

  const loadContent = useCallback(
    async (
      mode: SubscriptionMode,
      channelSlug: string,
      query: string,
      forceRefresh = false
    ) => {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMsg(null);

      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (forceRefresh) params.set("refresh", "1");

        if (mode === "daily") {
          let res = await fetch(`${basePath}/api/daily?${params.toString()}`);
          if (!res.ok) {
            res = await fetch(`${basePath}/api/daily.json`);
          }
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload.error || `请求失败 (${res.status})`);
          }
          const data: DailyApiResponse = await res.json();
          const qLower = query.trim().toLowerCase();
          const filteredEditions = qLower
            ? data.editions
                .map((ed) => {
                  const matched = ed.articles.filter(
                    (a) =>
                      a.title.toLowerCase().includes(qLower) ||
                      a.summary.toLowerCase().includes(qLower) ||
                      a.channelName.toLowerCase().includes(qLower)
                  );
                  return { ...ed, articles: matched, articleCount: matched.length };
                })
                .filter((ed) => ed.articles.length > 0)
            : data.editions;

          setEditions(filteredEditions);
          setFetchedAt(data.fetchedAt);
          if (filteredEditions.length > 0) {
            setSelectedEditionDate((prev) =>
              filteredEditions.some((e) => e.date === prev) ? prev : filteredEditions[0].date
            );
          } else {
            setSelectedEditionDate("");
          }
        } else {
          params.set("channel", channelSlug);
          let res = await fetch(`${basePath}/api/articles?${params.toString()}`);
          if (!res.ok) {
            res = await fetch(`${basePath}/api/articles/${channelSlug}.json`);
          }
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload.error || `请求失败 (${res.status})`);
          }
          const data: ArticlesApiResponse = await res.json();
          const qLower = query.trim().toLowerCase();
          const items = qLower
            ? data.items.filter(
                (item) =>
                  item.title.toLowerCase().includes(qLower) ||
                  item.summary.toLowerCase().includes(qLower) ||
                  item.channelName.toLowerCase().includes(qLower) ||
                  item.source.toLowerCase().includes(qLower)
              )
            : data.items;
          setArticles(items);
          setFetchedAt(data.fetchedAt);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "加载新闻源失败，请稍后重试");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [basePath]
  );

  const loadRawFeedSource = useCallback(async (path: string) => {
    setXmlLoading(true);
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setXmlSource(text);
    } catch {
      setXmlSource("<!-- 订阅源源码暂不可用，请点击刷新重试 -->");
    } finally {
      setXmlLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent(subscriptionMode, activeChannel, appliedQuery, false);
  }, [subscriptionMode, activeChannel, appliedQuery, loadContent]);

  useEffect(() => {
    loadRawFeedSource(feedRelativePath);
  }, [feedRelativePath, loadRawFeedSource]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2200);
    } catch {
      // Fallback for non-secure clipboard context
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedQuery(queryInput.trim());
  };

  const handleClearSearch = () => {
    setQueryInput("");
    setAppliedQuery("");
  };

  const displayArticles = useMemo(() => {
    if (subscriptionMode === "daily") {
      return activeEdition?.articles ?? [];
    }
    return articles;
  }, [subscriptionMode, activeEdition, articles]);

  const leadArticle = displayArticles[0] ?? null;
  const secondaryArticles = displayArticles.slice(1, 4);
  const indexArticles = displayArticles.slice(4);

  const fetchedTimeLabel = useMemo(() => {
    if (!fetchedAt) return "同步中";
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(fetchedAt));
    } catch {
      return fetchedAt.slice(11, 19);
    }
  }, [fetchedAt]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#1C1917]">
      {/* Top Bar Contract: Single row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-[#D6D0C4]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#frontpage"
            className="font-editorial text-xl font-bold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0"
          >
            人民网山西 RSS
          </a>

          <nav
            aria-label="主导航"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E]"
          >
            <a
              href="#frontpage"
              className="hover:text-[#1C1917] hover:underline underline-offset-8 decoration-[#9F1239] transition-colors whitespace-nowrap shrink-0"
            >
              新闻版面
            </a>
            <a
              href="#subscribe"
              className="hover:text-[#1C1917] hover:underline underline-offset-8 decoration-[#9F1239] transition-colors whitespace-nowrap shrink-0"
            >
              分栏订阅
            </a>
            <a
              href="#xml-preview"
              className="hover:text-[#1C1917] hover:underline underline-offset-8 decoration-[#9F1239] transition-colors whitespace-nowrap shrink-0"
            >
              XML 源码
            </a>
            <a
              href="#guide"
              className="hover:text-[#1C1917] hover:underline underline-offset-8 decoration-[#9F1239] transition-colors whitespace-nowrap shrink-0"
            >
              客户端指南
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleCopy(fullFeedUrl, "header-cta")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium bg-[#9F1239] text-white hover:bg-[#881337] transition-colors whitespace-nowrap shrink-0 min-h-[40px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9F1239]"
            >
              {copiedKey === "header-cta" ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>已复制订阅地址</span>
                </>
              ) : (
                <>
                  <Rss className="w-4 h-4" />
                  <span>复制 RSS 链接</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Masthead & RSS Subscription Utility */}
        <section id="subscribe" className="border-b border-[#1C1917]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 pt-8 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#D6D0C4] text-xs text-[#57534E]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[#1C1917]">{formatChinaCalendarDate()}</span>
                <span aria-hidden="true">·</span>
                <span>实时抓取人民网山西频道（sx.people.com.cn）全站栏目</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">最近同步：{fetchedTimeLabel}</span>
              </div>

              <div className="flex items-center gap-4">
                <a
                  href={`${basePath}/people-sx.opml`}
                  download="people-sx.opml"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1C1917] hover:text-[#9F1239] transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出全部分栏 OPML</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    loadContent(subscriptionMode, activeChannel, appliedQuery, true);
                    loadRawFeedSource(feedRelativePath);
                  }}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  <span>{refreshing ? "同步中" : "立即刷新"}</span>
                </button>
              </div>
            </div>

            <div className="py-7 border-b border-[#D6D0C4] flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <h1 className="font-editorial text-3xl sm:text-5xl font-bold tracking-tight text-[#1C1917] text-balance">
                  人民网山西频道 · RSS 订阅中心
                </h1>
                <p className="mt-3 text-sm sm:text-base text-[#57534E] leading-relaxed">
                  {subscriptionMode === "daily"
                    ? "按发布日期将人民网山西频道当日全部新闻汇总为一期日报，每天推送导读目录与完整正文。"
                    : `${currentChannelObj.description}。将下方标准订阅地址填入任意 RSS 阅读器，即可获取图文全文推送。`}
                </p>
              </div>

              {/* Subscription Mode & Feed Format Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start lg:self-end shrink-0">
                <div
                  role="tablist"
                  aria-label="订阅模式"
                  className="flex items-center gap-1 p-1 bg-[#EFECE5] border border-[#D6D0C4]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={subscriptionMode === "channels"}
                    onClick={() => setSubscriptionMode("channels")}
                    className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                      subscriptionMode === "channels"
                        ? "bg-[#1C1917] text-[#FAF8F4]"
                        : "text-[#57534E] hover:text-[#1C1917]"
                    }`}
                  >
                    分栏实时资讯流
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={subscriptionMode === "daily"}
                    onClick={() => setSubscriptionMode("daily")}
                    className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                      subscriptionMode === "daily"
                        ? "bg-[#1C1917] text-[#FAF8F4]"
                        : "text-[#57534E] hover:text-[#1C1917]"
                    }`}
                  >
                    每日新闻汇总
                  </button>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#EFECE5] border border-[#D6D0C4]">
                  {(
                    [
                      { key: "rss", label: "RSS 2.0" },
                      { key: "atom", label: "Atom 1.0" },
                      { key: "json", label: "JSON Feed" },
                    ] as const
                  ).map((fmt) => (
                    <button
                      key={fmt.key}
                      type="button"
                      onClick={() => setFeedFormat(fmt.key)}
                      className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                        feedFormat === fmt.key
                          ? "bg-[#FAF8F4] text-[#1C1917] border border-[#D6D0C4]"
                          : "text-[#57534E] hover:text-[#1C1917] border border-transparent"
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Channel Tabs (Channels Mode) OR Issue Date Strip (Daily Mode) */}
            {subscriptionMode === "daily" ? (
              <div className="py-4 border-b border-[#D6D0C4] flex items-center gap-2 overflow-x-auto">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#57534E] pr-2 whitespace-nowrap shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-[#9F1239]" />
                  <span>按日归档</span>
                </span>
                {editions.length === 0 && loading ? (
                  <span className="text-xs text-[#78716C] py-2">正在按日汇总报道...</span>
                ) : (
                  editions.map((ed, idx) => {
                    const isSelected = activeEdition?.date === ed.date;
                    return (
                      <button
                        key={ed.date}
                        type="button"
                        onClick={() => setSelectedEditionDate(ed.date)}
                        className={`px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] border tabular-nums ${
                          isSelected
                            ? "bg-[#1C1917] text-[#FAF8F4] border-[#1C1917]"
                            : "bg-transparent text-[#57534E] border-transparent hover:border-[#D6D0C4] hover:text-[#1C1917]"
                        }`}
                      >
                        {ed.date}
                        {idx === 0 ? " 最新" : ""}（{ed.articleCount}篇）
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="py-4 border-b border-[#D6D0C4] flex items-center gap-2 overflow-x-auto">
                {channels.map((ch) => {
                  const isActive = ch.slug === activeChannel;
                  return (
                    <button
                      key={ch.slug}
                      type="button"
                      onClick={() => setActiveChannel(ch.slug)}
                      className={`px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] border ${
                        isActive
                          ? "bg-[#1C1917] text-[#FAF8F4] border-[#1C1917]"
                          : "bg-transparent text-[#57534E] border-transparent hover:border-[#D6D0C4] hover:text-[#1C1917]"
                      }`}
                    >
                      {ch.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Live Subscribable Feed URL + Keyword Filter Bar */}
            <div className="pt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-8 flex flex-col sm:flex-row items-stretch sm:items-center bg-[#F2EFE9] border border-[#D6D0C4]">
                <div className="px-4 py-2.5 text-xs font-medium text-[#9F1239] border-b sm:border-b-0 sm:border-r border-[#D6D0C4] whitespace-nowrap shrink-0">
                  {subscriptionMode === "daily" ? "每日汇总订阅地址" : "当前分栏订阅地址"}
                </div>
                <div className="flex-1 px-4 py-2.5 overflow-x-auto">
                  <code className="font-mono-code text-xs sm:text-sm text-[#1C1917] whitespace-nowrap select-all">
                    {fullFeedUrl}
                  </code>
                </div>
                <div className="flex items-center border-t sm:border-t-0 sm:border-l border-[#D6D0C4] shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(fullFeedUrl, "bar-copy")}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#1C1917] hover:bg-[#E7E2D8] transition-colors whitespace-nowrap min-h-[42px]"
                  >
                    {copiedKey === "bar-copy" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#9F1239]" />
                        <span>已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>复制地址</span>
                      </>
                    )}
                  </button>
                  <a
                    href={feedRelativePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] hover:bg-[#E7E2D8] border-l border-[#D6D0C4] transition-colors whitespace-nowrap min-h-[42px]"
                  >
                    <span>直接打开</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <form
                onSubmit={handleSearchSubmit}
                className="lg:col-span-4 flex items-center bg-[#FAF8F4] border border-[#D6D0C4] focus-within:border-[#1C1917] transition-colors"
              >
                <Search className="w-4 h-4 text-[#78716C] ml-3.5 shrink-0" />
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="关键词筛选（如：太原、文旅、能源）"
                  aria-label="关键词筛选"
                  className="w-full px-3 py-2 text-sm bg-transparent text-[#1C1917] placeholder:text-[#78716C] focus:outline-none min-h-[42px]"
                />
                {(queryInput || appliedQuery) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    aria-label="清空筛选"
                    className="p-2 text-[#78716C] hover:text-[#1C1917]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2.5 text-xs font-medium bg-[#1C1917] text-[#FAF8F4] hover:bg-[#292524] transition-colors whitespace-nowrap shrink-0 min-h-[42px]"
                >
                  过滤源
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Front Page Broadsheet Preview */}
        <section id="frontpage" className="max-w-[1200px] mx-auto px-4 sm:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-4 border-b border-[#D6D0C4]">
            <div>
              <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-[#1C1917]">
                {subscriptionMode === "daily" && activeEdition
                  ? `人民网山西频道 · ${activeEdition.dateDisplay}（${activeEdition.weekday}）`
                  : `版面内容实时预览 — ${currentChannelObj.name}`}
              </h2>
              {subscriptionMode === "daily" && activeEdition && (
                <p className="mt-1 text-xs text-[#57534E]">
                  涵盖栏目：{activeEdition.channelsCovered.join(" · ")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs text-[#57534E] tabular-nums whitespace-nowrap">
                {loading
                  ? "正在抓取最新稿件..."
                  : subscriptionMode === "daily" && activeEdition
                  ? `当日共 ${activeEdition.articleCount} 篇报道`
                  : `共收录 ${displayArticles.length} 篇人民网山西频道报道`}
              </span>
              {subscriptionMode === "daily" && activeEdition && (
                <button
                  type="button"
                  onClick={() => setViewingFullEdition(activeEdition)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#9F1239] text-white hover:bg-[#881337] transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>阅读当日汇总全文</span>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-12 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
                <div className="lg:col-span-7 space-y-4">
                  <div className="h-4 w-40 bg-[#E7E2D8]" />
                  <div className="h-10 w-5/6 bg-[#E7E2D8]" />
                  <div className="h-24 w-full bg-[#EFECE5]" />
                </div>
                <div className="lg:col-span-5 aspect-[16/10] bg-[#E7E2D8]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-[#D6D0C4] animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-4 w-28 bg-[#E7E2D8]" />
                    <div className="h-6 w-full bg-[#E7E2D8]" />
                    <div className="h-16 w-full bg-[#EFECE5]" />
                  </div>
                ))}
              </div>
            </div>
          ) : errorMsg ? (
            <div className="my-10 p-8 bg-[#F2EFE9] border border-[#D6D0C4] text-center">
              <p className="font-editorial text-lg text-[#1C1917]">暂时无法同步最新稿件</p>
              <p className="mt-2 text-sm text-[#57534E]">{errorMsg}</p>
              <button
                type="button"
                onClick={() => loadContent(subscriptionMode, activeChannel, appliedQuery, true)}
                className="mt-5 px-5 py-2.5 text-sm font-medium bg-[#9F1239] text-white hover:bg-[#881337] transition-colors"
              >
                重新抓取
              </button>
            </div>
          ) : displayArticles.length === 0 ? (
            <div className="my-10 p-10 bg-[#F2EFE9] border border-[#D6D0C4] text-center">
              <p className="font-editorial text-lg text-[#1C1917]">
                当前条件下暂无匹配的报道
              </p>
              <p className="mt-2 text-sm text-[#57534E]">
                {appliedQuery
                  ? `未找到包含“${appliedQuery}”的近期报道，可以尝试更换关键词或查看全部栏目。`
                  : "该栏目近期暂无新增稿件，请切换其他栏目或稍后刷新。"}
              </p>
              {appliedQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="mt-5 px-5 py-2.5 text-sm font-medium bg-[#1C1917] text-[#FAF8F4] hover:bg-[#292524] transition-colors"
                >
                  查看全部稿件
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Tier 1: Lead Story */}
              {leadArticle && (
                <article className="py-8 border-b border-[#D6D0C4] grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch group">
                  <div className="lg:col-span-7 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                        <span className="font-semibold text-[#9F1239]">头条报道</span>
                        <span aria-hidden="true">·</span>
                        <span>{leadArticle.channelName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{leadArticle.source}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{leadArticle.pubDateDisplay}</span>
                      </div>

                      <h3 className="mt-3 font-editorial text-2xl sm:text-4xl font-bold text-[#1C1917] leading-snug text-balance">
                        <button
                          type="button"
                          onClick={() => setSelectedArticle(leadArticle)}
                          className="text-left hover:text-[#9F1239] transition-colors focus-visible:outline-2 focus-visible:outline-[#9F1239]"
                        >
                          {leadArticle.title}
                        </button>
                      </h3>

                      <p className="mt-5 text-[15px] sm:text-base text-[#292524] leading-[1.8] max-w-2xl first-letter:text-5xl first-letter:font-editorial first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-[0.9] first-letter:text-[#9F1239]">
                        {leadArticle.summary}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center gap-5 pt-4">
                      <button
                        type="button"
                        onClick={() => setSelectedArticle(leadArticle)}
                        className="px-4 py-2 text-xs sm:text-sm font-medium bg-[#1C1917] text-[#FAF8F4] hover:bg-[#9F1239] transition-colors whitespace-nowrap min-h-[40px]"
                      >
                        阅读全文
                      </button>
                      <a
                        href={leadArticle.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[#57534E] hover:text-[#1C1917] transition-colors whitespace-nowrap"
                      >
                        <span>查看原文</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <button
                      type="button"
                      onClick={() => setSelectedArticle(leadArticle)}
                      className="block w-full h-full text-left focus-visible:outline-2 focus-visible:outline-[#9F1239]"
                    >
                      <FeedImage
                        src={leadArticle.images[0]}
                        alt={leadArticle.title}
                        fallbackVariant="desk"
                        aspectClassName="aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[280px]"
                      />
                    </button>
                  </div>
                </article>
              )}

              {/* Tier 2: Secondary Features (3-Column Broadsheet Grid with hairline dividers) */}
              {secondaryArticles.length > 0 && (
                <div className="py-8 border-b border-[#D6D0C4] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#D6D0C4]">
                  {secondaryArticles.map((item, idx) => (
                    <article
                      key={item.id}
                      className={`group flex flex-col justify-between ${
                        idx === 0
                          ? "pb-6 md:pb-0 md:pr-7"
                          : idx === 1
                          ? "py-6 md:py-0 md:px-7"
                          : "pt-6 md:pt-0 md:pl-7"
                      }`}
                    >
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedArticle(item)}
                          className="block w-full mb-4 focus-visible:outline-2 focus-visible:outline-[#9F1239]"
                        >
                          <FeedImage
                            src={item.images[0]}
                            alt={item.title}
                            fallbackVariant={idx === 1 ? "heritage" : "desk"}
                            aspectClassName="aspect-[16/10]"
                          />
                        </button>

                        <div className="flex items-center gap-2 text-xs text-[#57534E]">
                          <span className="font-medium text-[#9F1239]">{item.channelName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{item.pubDateDisplay}</span>
                        </div>

                        <h3 className="mt-2 font-editorial text-lg sm:text-xl font-semibold text-[#1C1917] leading-snug">
                          <button
                            type="button"
                            onClick={() => setSelectedArticle(item)}
                            className="text-left hover:text-[#9F1239] transition-colors focus-visible:outline-2 focus-visible:outline-[#9F1239]"
                          >
                            {item.title}
                          </button>
                        </h3>

                        <p className="mt-2.5 text-sm text-[#57534E] leading-relaxed line-clamp-3">
                          {item.summary}
                        </p>
                      </div>

                      <div className="mt-4 pt-2 flex items-center justify-between text-xs text-[#78716C]">
                        <span>{item.source}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedArticle(item)}
                          className="font-medium text-[#1C1917] hover:text-[#9F1239] transition-colors"
                        >
                          详情 →
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* Tier 3: Broadsheet Index List */}
              {indexArticles.length > 0 && (
                <div className="pt-8">
                  <h3 className="text-xs font-semibold tracking-wider text-[#57534E] pb-3 border-b border-[#D6D0C4]">
                    更多新闻目录
                  </h3>
                  <ul className="divide-y divide-[#D6D0C4]">
                    {indexArticles.map((item) => (
                      <li
                        key={item.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 sm:gap-6 hover:bg-[#F2EFE9]/60 px-2 -mx-2 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-4 min-w-0">
                          <span className="text-xs font-medium text-[#9F1239] whitespace-nowrap shrink-0 w-24">
                            {item.channelName}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedArticle(item)}
                            className="font-editorial text-base sm:text-lg font-medium text-[#1C1917] hover:text-[#9F1239] text-left transition-colors truncate"
                          >
                            {item.title}
                          </button>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[#78716C] shrink-0">
                          <span>{item.source}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums whitespace-nowrap">
                            {item.pubDateDisplay}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Live XML / Feed Source Inspector */}
        <section id="xml-preview" className="border-t border-[#D6D0C4] bg-[#F2EFE9]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#D6D0C4]">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#9F1239] font-medium">
                  <Code2 className="w-4 h-4" />
                  <span>实时生成源码检查器</span>
                </div>
                <h2 className="mt-1 font-editorial text-2xl font-semibold text-[#1C1917]">
                  {feedFormat === "rss"
                    ? "RSS 2.0 XML 实时输出"
                    : feedFormat === "atom"
                    ? "Atom 1.0 XML 实时输出"
                    : "JSON Feed 1.1 实时输出"}
                </h2>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(xmlSource, "xml-copy")}
                  disabled={!xmlSource || xmlLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#FAF8F4] border border-[#D6D0C4] text-[#1C1917] hover:border-[#1C1917] transition-colors whitespace-nowrap min-h-[40px] disabled:opacity-50"
                >
                  {copiedKey === "xml-copy" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#9F1239]" />
                      <span>已复制源码</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>复制源码</span>
                    </>
                  )}
                </button>
                <a
                  href={feedRelativePath}
                  download={`people-sx-${subscriptionMode === "daily" ? "daily" : activeChannel}.${
                    feedFormat === "json" ? "json" : "xml"
                  }`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1C1917] text-[#FAF8F4] hover:bg-[#9F1239] transition-colors whitespace-nowrap min-h-[40px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载文件</span>
                </a>
              </div>
            </div>

            <div className="mt-6 bg-[#1C1917] text-[#E7E5E4] border border-[#292524] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#292524] flex items-center justify-between text-xs text-[#A8A29E] border-b border-[#44403C]">
                <span className="font-mono-code truncate">{feedRelativePath}</span>
                <span className="tabular-nums whitespace-nowrap shrink-0">
                  {xmlLoading ? "生成中..." : `${xmlSource.length.toLocaleString()} 字符`}
                </span>
              </div>
              <pre className="p-5 text-xs font-mono-code leading-relaxed overflow-x-auto max-h-[380px] overflow-y-auto">
                <code>{xmlLoading ? "正在请求服务端实时生成..." : xmlSource}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* RSS Client Setup Guide */}
        <section id="guide" className="border-t border-[#D6D0C4]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-12">
            <h2 className="font-editorial text-2xl font-semibold text-[#1C1917]">
              客户端订阅与定制用法
            </h2>
            <p className="mt-2 text-sm text-[#57534E]">
              本服务抓取自人民网山西频道（sx.people.com.cn）全站 12 个栏目，输出符合 W3C 标准的 RSS / Atom / JSON Feed。
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#D6D0C4] border-t border-b border-[#D6D0C4]">
              <div className="py-6 md:pr-8">
                <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
                  01. 分栏或全站直接订阅
                </h3>
                <p className="mt-2.5 text-sm text-[#57534E] leading-relaxed">
                  在 Folo、NetNewsWire、Reeder、Inoreader 或 Feedly 中添加{" "}
                  <code className="font-mono-code text-xs text-[#9F1239]">/rss.xml</code>{" "}
                  即可订阅全部新闻，也可按栏目选择如{" "}
                  <code className="font-mono-code text-xs text-[#9F1239]">/rss/yaowen.xml</code>。
                </p>
              </div>

              <div className="py-6 md:px-8">
                <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
                  02. 每日新闻汇总模式
                </h3>
                <p className="mt-2.5 text-sm text-[#57534E] leading-relaxed">
                  若不想被单篇推送打扰，可订阅{" "}
                  <code className="font-mono-code text-xs text-[#9F1239]">/rss/daily.xml</code>
                  ，阅读器每天仅接收一期完整当日新闻汇总，也可导入{" "}
                  <code className="font-mono-code text-xs text-[#9F1239]">people-sx.opml</code>{" "}
                  一次订阅全部分栏。
                </p>
              </div>

              <div className="py-6 md:pl-8">
                <h3 className="font-editorial text-lg font-semibold text-[#1C1917]">
                  03. 关键词专属过滤源
                </h3>
                <p className="mt-2.5 text-sm text-[#57534E] leading-relaxed">
                  在任何订阅链接末尾追加{" "}
                  <code className="font-mono-code text-xs text-[#9F1239]">?q=关键词</code>{" "}
                  或{" "}
                  <code className="font-mono-code text-xs text-[#9F1239]">&amp;limit=15</code>
                  ，即可生成只追踪特定地市、行业或关键词的定制 RSS 源。
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#D6D0C4] bg-[#F2EFE9]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#57534E]">
          <span>人民网山西频道 RSS 订阅源 · 实时抓取自 sx.people.com.cn</span>
          <div className="flex flex-wrap items-center gap-4">
            <a href={`${basePath}/rss.xml`} target="_blank" rel="noopener noreferrer" className="hover:text-[#1C1917]">
              全部新闻 RSS 2.0
            </a>
            <span aria-hidden="true">·</span>
            <a href={`${basePath}/rss/daily.xml`} target="_blank" rel="noopener noreferrer" className="hover:text-[#1C1917]">
              每日汇总 RSS
            </a>
            <span aria-hidden="true">·</span>
            <a href={`${basePath}/atom.xml`} target="_blank" rel="noopener noreferrer" className="hover:text-[#1C1917]">
              Atom 1.0
            </a>
            <span aria-hidden="true">·</span>
            <a href={`${basePath}/feed.json`} target="_blank" rel="noopener noreferrer" className="hover:text-[#1C1917]">
              JSON Feed
            </a>
            <span aria-hidden="true">·</span>
            <a href={`${basePath}/people-sx.opml`} download="people-sx.opml" className="hover:text-[#1C1917]">
              OPML
            </a>
          </div>
        </div>
      </footer>

      <ArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />

      <DailyEditionModal
        edition={viewingFullEdition}
        onClose={() => setViewingFullEdition(null)}
      />
    </div>
  );
}
