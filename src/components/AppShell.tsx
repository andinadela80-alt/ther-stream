import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Compass, Home, Mail, Wallet } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import signalBackground from "@/assets/ponscaster-signal-bg.jpg";
import fomoLogo from "@/assets/fomo-logo.jpg.asset.json";
import { AuthScreen } from "@/components/AuthScreen";
import { Avatar } from "@/components/Avatar";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { FollowsProvider } from "@/lib/follows";
import { usePreferences } from "@/lib/preferences";
import type { Profile } from "@/lib/social";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/messages", label: "Messages", icon: Mail },
  { to: "/fomo", label: "Fomo" },
] as const;

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: (user: User) => ReactNode }) {
  const { t } = usePreferences();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [unread, setUnread] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setUser(s?.user ?? null); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  // Signed out anywhere: always land back on the clean entry URL so the login screen never runs on /profile, /post, etc.
  useEffect(() => {
    if (!ready || user) return;
    if (window.location.pathname !== "/") window.location.replace("/");
  }, [ready, user]);

  useEffect(() => {
    if (!user) return;
    void supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false).then(({ count }) => setUnread(count ?? 0));
    const cols = "id, display_name, username, bio, avatar_url, created_at";
    void (async () => {
      let { data } = await supabase.from("profiles").select(cols).eq("id", user.id).maybeSingle();
      if (!data) {
        const meta = user.user_metadata ?? {};
        const res = await supabase.from("profiles").insert({ id: user.id, display_name: meta["full_name"] ?? meta["name"] ?? user.email?.split("@")[0] ?? null, avatar_url: meta["avatar_url"] ?? meta["picture"] ?? null }).select(cols).maybeSingle();
        data = res.data;
      }
      setProfile(data as Profile | null);
    })();
  }, [user]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <img src={signalBackground} alt="" width={1440} height={900} className="pointer-events-none fixed inset-0 h-full w-full object-cover" />
      {!ready ? null : !user ? (
        <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-10">
          <header className="text-center">
              <div className="relative mx-auto mb-5 grid size-16 place-items-center" aria-hidden="true">
              <span className="signal-ring absolute inset-0 rounded-full border border-primary/60" />
              <span className="signal-ring signal-ring-delay-1 absolute inset-0 rounded-full border border-primary/50" />
              <span className="signal-ring signal-ring-delay-2 absolute inset-0 rounded-full border border-primary/40" />
                <BrandLogo size={44} className="relative shadow-signal" />
            </div>
            <h1 className="font-display text-[22px] font-semibold leading-tight">Mindcaster — Where Ideas Become Onchain</h1>
            <span className="mt-2 inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{t("betaAccess")}</span>
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">Where Ideas Become Onchain</p>
          </header>
          <AuthScreen />
        </main>
      ) : (
        <FollowsProvider userId={user.id}>
          <header className="glass-panel sticky top-0 z-30 border-b border-surface/80">
            <div className="relative mx-auto flex h-14 max-w-[600px] items-center justify-between px-4">
              <Link to="/profile" search={{}} aria-label="Buka profil saya" className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar profile={profile} size={34} />
              </Link>
              {title === "Home" ? <><h1 className="sr-only">Home — Mindcaster Feed</h1><BrandLogo size={34} className="pointer-events-none absolute left-1/2 -translate-x-1/2" /></> : <h1 className="absolute left-1/2 max-w-[55%] -translate-x-1/2 truncate font-display text-base font-semibold">{title === "Discover" ? t("discover") : title === "Notifications" ? t("notifications") : title === "Messages" ? t("messages") : title === "Profile" ? t("profile") : title}</h1>}
              <div className="relative ml-auto">{actions}{actions && unread > 0 && <span aria-label="New notifications" className="pointer-events-none absolute right-1 top-1 size-2.5 rounded-full bg-destructive ring-2 ring-background" />}</div>
            </div>
          </header>
          <main className="relative z-10 mx-auto w-full max-w-[600px] space-y-3 px-3 pb-28 pt-4 sm:px-4">{children(user)}</main>
          <nav aria-label="Menu utama" className="glass-panel fixed inset-x-0 bottom-0 z-40 border-t border-surface/80 pb-[env(safe-area-inset-bottom)]">
            <ul className="mx-auto grid h-16 max-w-[600px] grid-cols-5">
              {NAV.map(({ to, label, ...rest }) => {
                const Icon = "icon" in rest ? rest.icon : null;
                const translatedLabel = label === "Home" ? t("home") : label === "Discover" ? t("discover") : label === "Messages" ? t("messages") : label;
                return (
                  <li key={to}>
                    <Link to={to} activeOptions={{ exact: true, includeSearch: false }} aria-label={translatedLabel} title={translatedLabel} className="group flex h-full items-center justify-center text-muted-foreground data-[status=active]:text-foreground">
                      <span className="relative grid size-11 place-items-center rounded-full transition group-data-[status=active]:bg-primary/20">
                        {Icon ? (
                          <Icon className="size-[22px]" />
                        ) : (
                          <img src={fomoLogo.url} alt="" width={816} height={816} className="size-[24px] rounded-md object-contain" />
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </FollowsProvider>
      )}
    </div>
  );
}
