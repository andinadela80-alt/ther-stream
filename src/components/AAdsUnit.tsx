import { useEffect, useState } from "react";

// A-ADS crypto ad unit (iframe, no script). Unit id is public.
const AADS_UNIT = "2457892";

export function AAdsUnit({ className = "" }: { className?: string }) {
  // Render only after hydration so a blocked/failed iframe never breaks the page.
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={`w-full overflow-hidden rounded-xl ${className}`} style={{ contain: "strict", height: 120 }}>
      {!mounted || failed ? (
        <div className="grid h-[120px] place-items-center rounded-xl bg-surface/60 text-xs text-muted-foreground">Sponsored</div>
      ) : (
        <iframe
          data-aa={AADS_UNIT}
          src={`https://acceptable.a-ads.com/${AADS_UNIT}/?size=Adaptive`}
          title="Sponsored"
          loading="lazy"
          onError={() => setFailed(true)}
          className="mx-auto block h-[120px] w-full border-0"
          style={{ overflow: "hidden" }}
        />
      )}
    </div>
  );
}
