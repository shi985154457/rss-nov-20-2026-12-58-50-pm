import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import type { DailyEdition } from "../types/feed";
import { FeedImage } from "./FeedImage";

interface DailyEditionModalProps {
  edition: DailyEdition | null;
  onClose: () => void;
}

export function DailyEditionModal({ edition, onClose }: DailyEditionModalProps) {
  useEffect(() => {
    if (!edition) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [edition, onClose]);

  if (!edition) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/50 backdrop-blur-[2px] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-edition-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#FAF8F4] border border-[#D6D0C4] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 sm:px-10 py-4 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-[#D6D0C4]">
          <div className="flex items-center gap-2 text-xs text-[#57534E] min-w-0">
            <span className="font-semibold text-[#9F1239] whitespace-nowrap">
              每日新闻汇总
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-[#1C1917] whitespace-nowrap">
              {edition.dateDisplay} {edition.weekday}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums whitespace-nowrap">
              共 {edition.articleCount} 篇报道
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭每日汇总阅览"
            className="inline-flex items-center justify-center w-9 h-9 text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFECE5] transition-colors focus-visible:outline-2 focus-visible:outline-[#9F1239]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 sm:px-10 py-8 sm:py-10">
          <div className="pb-6 border-b-2 border-[#1C1917]">
            <h2
              id="daily-edition-modal-title"
              className="font-editorial text-2xl sm:text-4xl font-bold text-[#1C1917] text-balance"
            >
              人民网山西频道 · {edition.dateDisplay} 每日汇总
            </h2>
            <p className="mt-2.5 text-sm text-[#57534E] leading-relaxed">
              {edition.weekday} · 涵盖栏目：{edition.channelsCovered.join("、")}
            </p>
          </div>

          {/* Newspaper Table of Contents */}
          <nav
            aria-label="本期导读目录"
            className="mt-6 p-5 bg-[#F2EFE9] border border-[#D6D0C4]"
          >
            <h3 className="text-xs font-semibold tracking-wider text-[#9F1239] pb-3 border-b border-[#D6D0C4]">
              本期目录导读（共 {edition.articleCount} 篇）
            </h3>
            <ol className="mt-3 space-y-2 text-sm">
              {edition.articles.map((art, idx) => (
                <li key={art.id} className="flex items-baseline gap-3">
                  <span className="font-mono-code text-xs text-[#78716C] tabular-nums w-6 shrink-0">
                    {String(idx + 1).padStart(2, "0")}.
                  </span>
                  <a
                    href={`#edition-art-${art.id}`}
                    className="text-[#1C1917] hover:text-[#9F1239] hover:underline underline-offset-4 transition-colors font-medium"
                  >
                    {art.title}
                  </a>
                  <span className="text-xs text-[#78716C] whitespace-nowrap shrink-0">
                    {art.channelName}
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          {/* Compiled Articles */}
          <div className="mt-8 divide-y divide-[#D6D0C4]">
            {edition.articles.map((art, idx) => (
              <article
                key={art.id}
                id={`edition-art-${art.id}`}
                className="py-8 first:pt-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#57534E]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-code text-[#9F1239] font-semibold tabular-nums">
                      第 {String(idx + 1).padStart(2, "0")} 篇
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[#1C1917]">{art.channelName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{art.pubDateDisplay}</span>
                  </div>
                  <a
                    href={art.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#57534E] hover:text-[#9F1239] transition-colors"
                  >
                    <span>原文</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <h3 className="mt-2.5 font-editorial text-xl sm:text-2xl font-bold text-[#1C1917] leading-snug text-balance">
                  {art.title}
                </h3>

                {art.images.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {art.images.map((imgUrl, imgIdx) => (
                      <figure key={imgUrl}>
                        <FeedImage
                          src={imgUrl}
                          alt={`${art.title} 配图 ${imgIdx + 1}`}
                          aspectClassName="aspect-[16/10]"
                          className="w-full max-w-2xl"
                        />
                      </figure>
                    ))}
                  </div>
                )}

                <div className="mt-4 max-w-2xl space-y-4 text-[15px] sm:text-[16px] leading-[1.8] text-[#292524]">
                  {art.paragraphs.map((para, pIdx) => (
                    <p key={pIdx} className={pIdx === 0 ? "font-medium text-[#1C1917]" : ""}>
                      {para}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
