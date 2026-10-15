import { ExternalLink, Megaphone } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AAdsUnit } from "@/components/AAdsUnit";
import { BrandLogo } from "@/components/BrandLogo";
import type { Ad } from "@/lib/ads";

export function SponsoredPost({ ad }: { ad: Ad }) {
  const cls = "mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground";
  return (
    <article className="feed-card rounded-[24px] border border-surface/80 p-4">
      <div className="flex items-center gap-3">
        <BrandLogo size={40} className="rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Mindcaster Ads</p>
          <p className="text-xs text-muted-foreground">@ads</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary"><Megaphone className="size-3" />Sponsored</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm">{ad.text}</p>
      {ad.aads && <AAdsUnit className="mt-3" />}
      {ad.image && <img src={ad.image} alt="" loading="lazy" className="mt-3 aspect-[16/9] w-full rounded-xl object-cover" />}
      {ad.href && ad.cta && (ad.external
        ? <a href={ad.href} target="_blank" rel="noreferrer" className={cls}>{ad.cta}<ExternalLink className="size-3.5" /></a>
        : <Link to={ad.href} className={cls}>{ad.cta}</Link>)}
    </article>
  );
}
