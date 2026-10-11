import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { normalize, POST_SELECT, type Post } from "@/lib/social";

export const Route = createFileRoute("/cashtag")({
  staticData: { sitemap: false },
  validateSearch: zodValidator(z.object({ s: fallback(z.string(), "").default("") })),
  head: () => ({
    meta: [
      { title: "Cashtag — Mindcaster" },
      { name: "description", content: "Community posts about a token cashtag on Mindcaster." },
      { property: "og:title", content: "Cashtag — Mindcaster" },
      { property: "og:description", content: "Community posts about a token cashtag on Mindcaster." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CashtagRoute,
});

function CashtagRoute() {
  const { s } = Route.useSearch();
  const tag = s.replace(/[^A-Za-z0-9]/g, "").slice(0, 15).toUpperCase();
  return <AppShell title={`$${tag}`}>{(u) => <CashtagFeed tag={tag} userId={u.id} />}</AppShell>;
}

function CashtagFeed({ tag, userId }: { tag: string; userId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!tag) return setPosts([]);
    const { data, error } = await supabase.from("posts").select(POST_SELECT).ilike("content", `%$${tag}%`).order("created_at", { ascending: false }).limit(50);
    if (error) return setError(error.message);
    setPosts(normalize(data).filter((p) => new RegExp(`\\$${tag}\\b`, "i").test(p.content)));
  }, [tag]);
  useEffect(() => { void load(); }, [load]);
  return (
    <>
      <section className="glass-panel rounded-[24px] border border-surface/80 p-4">
        <h2 className="font-display text-xl font-bold text-primary">${tag}</h2>
        <p className="text-xs text-muted-foreground">{posts.length} community posts</p>
      </section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {posts.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No posts about ${tag} yet.</p>}
      {posts.map((p) => <PostCard key={p.id} post={p} userId={userId} onChange={load} onError={setError} />)}
    </>
  );
}
