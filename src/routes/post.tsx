import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { fetchPosts, type Post } from "@/lib/social";

export const Route = createFileRoute("/post")({
  staticData: { sitemap: false },
  validateSearch: z.object({ id: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Post — Mindcaster" },
      { name: "description", content: "View a post shared on Mindcaster." },
      { property: "og:title", content: "Post — Mindcaster" },
      { property: "og:description", content: "A post shared on Mindcaster — Where Ideas Become Onchain." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "SocialMediaPosting", headline: "Post on Mindcaster", publisher: { "@type": "Organization", name: "Mindcaster" } }) }],
  }),
  component: PostRoute,
});

function PostRoute() {
  const { id } = Route.useSearch();
  return <AppShell title="Post">{(u) => <PostView userId={u.id} id={id} />}</AppShell>;
}

function PostView({ userId, id }: { userId: string; id: string | undefined }) {
  const router = useRouter();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    if (!id) return setPost(null);
    try { setPost((await fetchPosts({ ids: [id] }))[0] ?? null); } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
  }, [id]);
  useEffect(() => { setPost(undefined); void load(); }, [load]);
  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => {
        if ((window.history.state?.__TSR_index ?? 0) > 0) router.history.back();
        else void navigate({ to: "/" });
      }}><ArrowLeft className="size-4" />Back</Button>
      {error && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><Button variant="surface" size="sm" onClick={() => void load()}>Try again</Button></div>}
      {post === undefined && !error && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}
      {post === null && <p className="py-6 text-center text-sm text-muted-foreground">Post not found.</p>}
      {post && <PostCard key={post.id} post={post} userId={userId} onChange={load} onError={setError} detail />}
    </div>
  );
}
