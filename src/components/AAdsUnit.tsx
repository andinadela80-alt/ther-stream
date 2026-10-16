import { useEffect, useState } from "react";

// A-ADS crypto ad unit (iframe, no script). Unit id is public.
// Markup mirrors the official embed from a-ads.com (unit 2457892, adaptive size).
const AADS_UNIT = "2457892";

export function AAdsUnit({ className = "" }: { className?: string }) {
  // Render only after hydration so a blocked/failed iframe never breaks the page.
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      id="frame"
      className={`relative mx-auto w-full overflow-hidden rounded-xl ${className}`}
      style={{ zIndex: 99998, contain: "layout paint style", minHeight: 90 }}
    >
      {!mounted || failed ? (
        <div className="grid h-[90px] place-items-center rounded-xl bg-surface/60 text-xs text-muted-foreground">
          Sponsored
        </div>
      ) : (
        <iframe
          data-aa={AADS_UNIT}
          src={`https://acceptable.a-ads.com/${AADS_UNIT}/?size=Adaptive`}
          title="Sponsored"
          loading="lazy"
          onError={() => setFailed(true)}
          className="mx-auto block h-auto w-[70%] min-w-[260px] overflow-hidden border-0 p-0"
          style={{ display: "block" }}
        />
      )}
    </div>
  );
}
