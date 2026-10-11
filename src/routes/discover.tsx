import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { AAdsUnit } from "@/components/AAdsUnit";
import { DiscoverBanners } from "@/components/DiscoverBanners";
import { IdentityBadges } from "@/components/IdentityBadges";
import { PostCard } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { displayName, fetchPosts, handle, type Post, type Profile } from "@/lib/social";

export const Route = createFileRoute("/discover")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Discover — Mindcaster" },
      { name: "description", content: "Find people and trending posts on Mindcaster." },
      { property: "og:title", content: "Discover — Mindcaster" },
      { property: "og:description", content: "Find people and trending posts on Mindcaster." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell title="Discover">{(u) => <Discover user={u} />}</AppShell>,
});

function Discover({ user }: { user: User }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [trending, setTrending] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => fetchPosts().then((ps) => {
    const score = (p: Post) => p.post_likes.length * 2 + p.post_reposts.length * 3 + p.post_comments.length * 2 + p.post_reactions.length;
    setTrending([...ps].sort((a, b) => score(b) - score(a)).slice(0, 15));
  }).catch((e: Error) => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      let query = supabase.from("profiles").select("id, display_name, username, bio, avatar_url, created_at").neq("id", user.id).limit(12);
      const term = q.trim().replace(/[%,()]/g, "");
      if (term) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
      else query = query.order("created_at", { ascending: false });
      const { data } = await query;
      setPeople((data ?? []) as Profile[]);
    }, 250);
    return () => clearTimeout(t);
  }, [q, user.id]);

  return (
    <>
      <label className="relative block">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or @username" className="glass-panel h-11 w-full rounded-full border border-surface/80 pl-10 pr-4 text-sm outline-none focus:border-primary" />
      </label>
      <DiscoverBanners />
      <div className="mt-3"><p className="mb-1 text-[11px] font-semibold text-muted-foreground">Sponsored</p><AAdsUnit /></div>
      <section className="glass-panel rounded-[24px] border border-surface/80 p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">{q ? "Search results" : "New users"}</h2>
        {people.length === 0 && <p className="text-sm text-muted-foreground">No users found.</p>}
        <ul className="space-y-3">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <Link to="/profile" search={{ id: p.id }} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar profile={p} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 truncate text-sm font-semibold">{displayName(p)}<IdentityBadges username={p.username} /></span>
                  <span className="block truncate text-xs text-muted-foreground">{handle(p) ?? p.bio ?? ""}</span>
                </span>
              </Link>
              <Link to="/messages" search={{ with: p.id }} className="rounded-full border border-border/60 bg-surface/70 px-3 py-1.5 text-xs font-semibold">Message</Link>
            </li>
          ))}
        </ul>
      </section>
      <h2 className="px-1 pt-2 font-display text-sm font-semibold">Trending</h2>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {trending.map((p) => <PostCard key={p.id} post={p} userId={user.id} onChange={load} onError={setError} />)}
    </>
  );
}
