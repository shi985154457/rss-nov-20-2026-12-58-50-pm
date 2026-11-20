import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import type { ArticleItem } from "../types/feed";
import { FeedImage } from "./FeedImage";

interface ArticleModalProps {
  article: ArticleItem | null;
  onClose: () => void;
}

export function ArticleModal({ article, onClose }: ArticleModalProps) {
  useEffect(() => {
    if (!article) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [article, onClose]);

  if (!article) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/45 backdrop-blur-[2px] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#FAF8F4] border border-[#D6D0C4] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 sm:px-10 py-4 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-[#D6D0C4]">
          <div className="flex items-center gap-2 text-xs text-[#57534E] min-w-0">
            <span className="font-medium text-[#9F1239] whitespace-nowrap">
              {article.channelName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{article.source}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums whitespace-nowrap">{article.pubDateDisplay}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1C1917] hover:text-[#9F1239] transition-colors whitespace-nowrap shrink-0 py-1.5 px-2.5 border border-[#D6D0C4] hover:border-[#9F1239]"
            >
              <span>原文链接</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭阅读视图"
              className="inline-flex items-center justify-center w-9 h-9 text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFECE5] transition-colors focus-visible:outline-2 focus-visible:outline-[#9F1239]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <article className="px-6 sm:px-10 py-8 sm:py-10">
          <h2
            id="article-modal-title"
            className="font-editorial text-2xl sm:text-3xl font-semibold text-[#1C1917] leading-snug text-balance"
          >
            {article.title}
          </h2>

          <div className="mt-4 pb-6 border-b border-[#D6D0C4] flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
            <span>来源：{article.source}</span>
            {article.editor && (
              <>
                <span aria-hidden="true">·</span>
                <span>{article.editor}</span>
              </>
            )}
          </div>

          {article.images.length > 0 && (
            <div className="mt-7 space-y-4">
              {article.images.map((imgUrl, idx) => (
                <figure key={imgUrl}>
                  <FeedImage
                    src={imgUrl}
                    alt={`${article.title} 配图 ${idx + 1}`}
                    aspectClassName="aspect-[16/10]"
                    className="w-full"
                  />
                  <figcaption className="mt-2 text-xs font-editorial text-[#57534E] italic">
                    图 {idx + 1} — {article.source}新闻配图
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          <div className="mt-7 max-w-2xl space-y-5 text-[16px] leading-[1.8] text-[#292524]">
            {article.paragraphs.map((para, idx) => (
              <p key={idx} className={idx === 0 ? "font-medium text-[#1C1917]" : ""}>
                {para}
              </p>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
