import { useEffect, useState } from "react";
import { X } from "lucide-react";

import bannerOgNft from "@/assets/banner-og-nft.png.asset.json";
import bannerEnterMind from "@/assets/banner-enter-mind.png.asset.json";
import bannerMind from "@/assets/banner-buy-mind-pons.png.asset.json";

type Soon = { emoji: string; title: string; text: string };
// Set `href` on the $MIND banner once the PONS link is ready.
const BANNERS: { src: string; alt: string; href?: string; soon?: Soon }[] = [
  { src: bannerMind.url, alt: "Buy $MIND on PONS", href: "https://www.ponsfamily.com/launchpad/0x7d249d242a02e19a10b367a2fa9407cb03bee1ac" },
  { src: bannerOgNft.url, alt: "Mindcaster — Get OG NFT", soon: { emoji: "👑", title: "Coming Soon", text: "Mindcaster OG NFT isn't open yet. Stay tuned — the first OGs will get special perks." } },
  { src: bannerEnterMind.url, alt: "Mindcaster — Enter the Mind. Discover. Connect. Cast." },
];

const ROTATE_MS = 5000;

export function DiscoverBanners() {
  const [index, setIndex] = useState(0);
  const [soon, setSoon] = useState<Soon | null>(null);
  const showSoon = !!soon;
  const setShowSoon = (v: boolean) => { if (!v) setSoon(null); };

  // Pause auto-rotation while the "soon" popup is open.
  useEffect(() => {
    if (showSoon) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % BANNERS.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [showSoon]);

  return (
    <>
      <div className="relative overflow-hidden rounded-[24px] border border-surface/80">
        {BANNERS.map((b, i) => {
          const img = (
            <img
              src={b.src}
              alt={b.alt}
              className={`aspect-[16/9] w-full object-cover transition-opacity duration-700 ${i === index ? "opacity-100" : "pointer-events-none absolute inset-0 opacity-0"}`}
              loading={i === 0 ? "eager" : "lazy"}
            />
          );
          if (b.href) return (
            <a key={b.src} href={b.href} target="_blank" rel="noreferrer" aria-label={b.alt} className={`block w-full ${i === index ? "" : "absolute inset-0"}`}>{img}</a>
          );
          return b.soon ? (
            <button
              key={b.src}
              type="button"
              aria-label={b.alt}
              onClick={() => setSoon(b.soon!)}
              className={`block w-full text-left ${i === index ? "" : "absolute inset-0"}`}
            >
              {img}
            </button>
          ) : (
            <div key={b.src} className={`w-full ${i === index ? "" : "absolute inset-0"}`}>
              {img}
            </div>
          );
        })}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {BANNERS.map((b, i) => (
            <button
              key={b.src}
              type="button"
              aria-label={`Baner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
            />
          ))}
        </div>
      </div>

      {showSoon && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Coming soon"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setShowSoon(false)}
        >
          <div
            className="glass-panel relative w-full max-w-xs rounded-[24px] border border-surface/80 p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setShowSoon(false)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-surface/70"
            >
              <X className="size-4" />
            </button>
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/15 text-2xl">{soon!.emoji}</div>
            <h3 className="font-display text-lg font-bold">{soon!.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{soon!.text}</p>
            <button
              type="button"
              onClick={() => setShowSoon(false)}
              className="mt-4 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Oke
            </button>
          </div>
        </div>
      )}
    </>
  );
}
