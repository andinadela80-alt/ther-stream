import { useSyncExternalStore } from "react";
import { BadgeCheck } from "lucide-react";

import ogBadge from "@/assets/og-badge.jpg.asset.json";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";

const CURATED = new Set(["ybs", "thorvox", "mindcaster"]);

type BadgeMap = Map<string, { og: boolean; verified: boolean }>;
let paid: BadgeMap = new Map();
let loaded = false;
const listeners = new Set<() => void>();

export async function refreshBadges() {
  loaded = true;
  const now = new Date().toISOString();
  const { data } = await supabase.from("verified_badges").select("og, verified_until, profiles(username)").or(`verified_until.gt.${now},og.eq.true`);
  const next: BadgeMap = new Map();
  for (const row of (data ?? []) as { og: boolean; verified_until: string; profiles: { username: string | null } | null }[]) {
    const u = row.profiles?.username?.toLowerCase();
    if (u) next.set(u, { og: row.og, verified: Date.parse(row.verified_until) > Date.now() });
  }
  paid = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!loaded && typeof window !== "undefined") void refreshBadges();
  return () => listeners.delete(l);
}

export function IdentityBadges({ username }: { username?: string | null | undefined }) {
  const map = useSyncExternalStore(subscribe, () => paid, () => paid);
  const key = username?.toLowerCase();
  if (!key) return null;
  const sub = map.get(key);
  const curated = CURATED.has(key);
  if (!curated && !sub) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label="Mindcaster badges" title="Mindcaster badges">
      {(curated || sub?.verified) && <BadgeCheck className="size-4 fill-primary text-primary-foreground" />}
      {curated && <BrandLogo size={16} className="rounded-full ring-1 ring-primary/40" />}
      {sub?.og && <img src={ogBadge.url} alt="OG" title="OG member" width={16} height={16} className="size-4 rounded-full ring-1 ring-primary/40" />}
    </span>
  );
}
