import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AtSign, Heart, Mail, MessageCircle, Repeat2, SmilePlus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { IdentityBadges } from "@/components/IdentityBadges";
import { supabase } from "@/integrations/supabase/client";
import { displayName, timeAgo, type Author } from "@/lib/social";

export const Route = createFileRoute("/notifications")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Notifications — Mindcaster" },
      { name: "description", content: "See who liked, reacted, commented, reminded, and messaged you." },
      { property: "og:title", content: "Notifications — Mindcaster" },
      { property: "og:description", content: "Latest activity on your Mindcaster account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell title="Notifications">{() => <Notifications />}</AppShell>,
});

type Notif = { id: string; type: string; detail: string | null; read: boolean; created_at: string; actor_id: string; post_id: string | null; actor: Author };
const META: Record<string, { icon: typeof Heart; text: string }> = {
  like: { icon: Heart, text: "liked your post" },
  repost: { icon: Repeat2, text: "reminded your post" },
  reaction: { icon: SmilePlus, text: "memberi reaksi" },
  comment: { icon: MessageCircle, text: "mengomentari:" },
  message: { icon: Mail, text: "sent a message:" },
  mention: { icon: AtSign, text: "mentioned you:" },
};

function Notifications() {
  const [items, setItems] = useState<Notif[] | null>(null);
  useEffect(() => {
    void supabase.from("notifications")
      .select("id, type, detail, read, created_at, actor_id, actor:profiles!notifications_actor_id_fkey(id, display_name, username, avatar_url)")
      .order("created_at", { ascending: false }).limit(60)
      .then(async ({ data }) => {
        setItems((data ?? []) as unknown as Notif[]);
        await supabase.from("notifications").update({ read: true }).eq("read", false);
      });
  }, []);

  if (!items) return null;
  if (items.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No notifications yet.</p>;
  return (
    <ul className="glass-panel divide-y divide-border/50 overflow-hidden rounded-[24px] border border-surface/80">
      {items.map((n) => {
        const m = META[n.type] ?? META["like"]!;
        const Icon = m.icon;
        const body = (
          <div className={`flex items-start gap-3 p-4 ${n.read ? "" : "bg-primary/10"}`}>
            <Icon className="mt-2.5 size-4 shrink-0 text-primary" />
            <Avatar profile={n.actor} size={36} />
            <p className="min-w-0 flex-1 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold">{displayName(n.actor)}<IdentityBadges username={n.actor?.username} /></span> {m.text} {n.type === "reaction" ? n.detail : n.detail && <span className="text-muted-foreground">“{n.detail}”</span>}
              <span className="block text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
            </p>
          </div>
        );
        return <li key={n.id}>{n.type === "message" ? <Link to="/messages" search={{ with: n.actor_id }}>{body}</Link> : <Link to="/profile" search={{ id: n.actor_id }}>{body}</Link>}</li>;
      })}
    </ul>
  );
}
