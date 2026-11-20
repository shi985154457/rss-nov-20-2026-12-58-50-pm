import { useState } from "react";
import { Newspaper } from "lucide-react";
import broadsheetDeskImg from "../assets/images/shanxi_broadsheet_desk_1795149908141.jpg";
import heritageEavesImg from "../assets/images/shanxi_heritage_eaves_1795149908475.jpg";

interface FeedImageProps {
  src?: string;
  alt: string;
  className?: string;
  aspectClassName?: string;
  fallbackVariant?: "desk" | "heritage" | "card";
}

export function FeedImage({
  src,
  alt,
  className = "",
  aspectClassName = "aspect-[16/10]",
  fallbackVariant = "card",
}: FeedImageProps) {
  const [stage, setStage] = useState<"proxy" | "direct" | "failed">("proxy");

  if (!src || stage === "failed") {
    if (fallbackVariant === "desk" || fallbackVariant === "heritage") {
      const editorialSrc =
        fallbackVariant === "desk" ? broadsheetDeskImg : heritageEavesImg;
      return (
        <div
          className={`relative overflow-hidden bg-[#EFECE5] border border-[#D6D0C4] ${aspectClassName} ${className}`}
        >
          <img
            src={editorialSrc}
            alt={alt}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none flex items-end p-4">
            <span className="text-xs font-editorial text-[#FAF8F4]/90 line-clamp-1">
              人民网山西频道 · 精选配图
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFECE5] border border-[#D6D0C4] text-[#78716C] p-6 text-center ${aspectClassName} ${className}`}
      >
        <Newspaper className="w-7 h-7 stroke-[1.25] mb-2 text-[#9F1239]/70" />
        <span className="font-editorial text-xs text-[#57534E] line-clamp-2 max-w-[220px]">
          {alt}
        </span>
      </div>
    );
  }

  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  const imgUrl =
    stage === "proxy" ? `${base}/api/image?url=${encodeURIComponent(src)}` : src;

  return (
    <div className={`overflow-hidden bg-[#EFECE5] ${aspectClassName} ${className}`}>
      <img
        src={imgUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setStage((prev) => (prev === "proxy" ? "direct" : "failed"))}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
    </div>
  );
}
