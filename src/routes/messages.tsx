import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { IdentityBadges } from "@/components/IdentityBadges";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { displayName, handle, timeAgo, type Profile } from "@/lib/social";

export const Route = createFileRoute("/messages")({
  staticData: { sitemap: false },
  validateSearch: z.object({ with: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Messages — Mindcaster" },
      { name: "description", content: "Send direct messages (DMs) to other Mindcaster users." },
      { property: "og:title", content: "Messages — Mindcaster" },
      { property: "og:description", content: "Direct messages between Mindcaster users." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

type Msg = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string };
const PROFILE_COLS = "id, display_name, username, bio, avatar_url, created_at";

function MessagesPage() {
  const { with: other } = Route.useSearch();
  return <AppShell title="Messages">{(u) => (other ? <Thread user={u} otherId={other} /> : <Inbox user={u} />)}</AppShell>;
}

function Inbox({ user }: { user: User }) {
  const [convos, setConvos] = useState<{ profile: Profile; last: Msg }[] | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("direct_messages").select("*").order("created_at", { ascending: false }).limit(300);
      const latest = new Map<string, Msg>();
      for (const m of (data ?? []) as Msg[]) {
        const o = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        if (!latest.has(o)) latest.set(o, m);
      }
      const ids = [...latest.keys()];
      const { data: ps } = ids.length ? await supabase.from("profiles").select(PROFILE_COLS).in("id", ids) : { data: [] };
      setConvos(((ps ?? []) as Profile[]).map((p) => ({ profile: p, last: latest.get(p.id)! })).sort((a, b) => b.last.created_at.localeCompare(a.last.created_at)));
    })();
  }, [user.id]);

  if (!convos) return null;
  if (convos.length === 0) return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      No conversations yet. <Link to="/discover" className="font-semibold text-link underline">Find people on Discover</Link> to start a DM.
    </div>
  );
  return (
    <ul className="glass-panel divide-y divide-border/50 overflow-hidden rounded-[24px] border border-surface/80">
      {convos.map(({ profile, last }) => (
        <li key={profile.id}>
          <Link to="/messages" search={{ with: profile.id }} className="flex items-center gap-3 p-4">
            <Avatar profile={profile} />
            <span className="min-w-0 flex-1">
              <span className="flex justify-between gap-2"><span className="flex items-center gap-1 truncate text-sm font-semibold">{displayName(profile)}<IdentityBadges username={profile.username} /></span><span className="text-xs text-muted-foreground">{timeAgo(last.created_at)}</span></span>
              <span className="block truncate text-sm text-muted-foreground">{last.sender_id === user.id ? "You: " : ""}{last.content}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Thread({ user, otherId }: { user: User; otherId: string }) {
  const [other, setOther] = useState<Profile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("direct_messages").select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`)
      .order("created_at").limit(200);
    setMsgs((data ?? []) as Msg[]);
  }, [user.id, otherId]);

  useEffect(() => {
    void supabase.from("profiles").select(PROFILE_COLS).eq("id", otherId).maybeSingle().then(({ data }) => setOther(data as Profile | null));
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [otherId, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const { error } = await supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: otherId, content: draft.trim() });
    if (error) return setError(error.message);
    setDraft(""); void load();
  }

  if (otherId === user.id) return <p className="text-sm text-muted-foreground">You can't message yourself.</p>;
  return (
    <div className="glass-panel flex min-h-[70vh] flex-col rounded-[24px] border border-surface/80">
      <div className="flex items-center gap-3 border-b border-border/50 p-3">
        <Link to="/messages" search={{}} aria-label="Back" className="grid size-9 place-items-center rounded-full hover:bg-muted"><ArrowLeft className="size-4" /></Link>
        <Avatar profile={other} size={36} />
        <Link to="/profile" search={{ id: otherId }} className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">{displayName(other)}<IdentityBadges username={other?.username} /></p>
          {handle(other) && <p className="text-xs text-muted-foreground">{handle(other)}</p>}
        </Link>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground">Send the first message.</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-surface"}`}>{m.content}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="px-4 text-sm text-destructive">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-border/50 p-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} placeholder="Write a message…" className="h-10 flex-1 rounded-full border border-border/60 bg-surface/75 px-4 text-sm outline-none focus:border-primary" />
        <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim()}><Send className="size-4" /></Button>
      </form>
    </div>
  );
}
