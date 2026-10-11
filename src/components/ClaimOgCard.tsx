import { useEffect, useState } from "react";

import ogBadge from "@/assets/og-badge.jpg.asset.json";
import { refreshBadges } from "@/components/IdentityBadges";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const LIMIT = 50;

export function ClaimOgCard() {
  const [status, setStatus] = useState<{ used: number; claimed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.rpc("og_claim_status");
    const row = data?.[0];
    if (row) setStatus({ used: row.used, claimed: row.claimed });
  }
  useEffect(() => { void load(); }, []);

  if (!status || status.claimed || status.used >= LIMIT) return msg ? <p className="text-sm text-primary">{msg}</p> : null;

  async function claim() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("claim_og_badge");
    setBusy(false);
    if (error) { setMsg(error.message); void load(); return; }
    setMsg("OG badge claimed! It now shows next to your name.");
    await refreshBadges();
    void load();
  }

  return (
    <section className="glass-panel flex items-center gap-3 rounded-[24px] border border-primary/40 bg-gradient-to-r from-primary/25 to-surface p-4">
      <img src={ogBadge.url} alt="OG badge" width={48} height={48} className="size-12 rounded-full ring-2 ring-primary/50" />
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold">Claim your free OG badge</p>
        <p className="text-xs text-muted-foreground">Only for the first {LIMIT} users · {LIMIT - status.used} left</p>
        {msg && <p role="alert" className="mt-1 text-xs text-destructive">{msg}</p>}
      </div>
      <Button size="sm" onClick={() => void claim()} disabled={busy}>{busy ? "Claiming…" : "Claim"}</Button>
    </section>
  );
}
