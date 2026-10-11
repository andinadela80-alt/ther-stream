import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Plus, Send, Trash2, X } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/upload";
import { searchMusic, type Track } from "@/lib/music.functions";
import { displayName, timeAgo, type Author } from "@/lib/social";

type Story = { id: string; author_id: string; media_url: string; media_type: "image" | "video"; music_url: string | null; music_title: string | null; created_at: string; author: Author };
type Group = { author: Author; authorId: string; items: Story[] };

export function Stories({ userId, onError }: { userId: string; onError: (m: string) => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<{ g: number; i: number } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("stories" as never)
      .select("id, author_id, media_url, media_type, music_url, music_title, created_at, author:profiles!stories_author_id_fkey(id, display_name, username, avatar_url)")
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true });
    if (error) return onError(error.message);
    const map = new Map<string, Group>();
    for (const s of (data ?? []) as unknown as Story[]) {
      const g = map.get(s.author_id) ?? { author: s.author, authorId: s.author_id, items: [] };
      g.items.push(s); map.set(s.author_id, g);
    }
    const list = [...map.values()].sort((a, b) => (a.authorId === userId ? -1 : b.authorId === userId ? 1 : 0));
    setGroups(list);
  }, [userId, onError]);
  useEffect(() => { void load(); }, [load]);

  const [draft, setDraft] = useState<{ file: File; preview: string; music: Track | null } | null>(null);
  const [mq, setMq] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const findMusic = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setSearching(true); setSearchErr("");
    try { setResults(await searchMusic(term.trim())); }
    catch { setSearchErr("Couldn't reach music search. Check your connection and try again."); }
    finally { setSearching(false); }
  }, []);
  useEffect(() => {
    if (!draft || draft.music) return;
    const t = setTimeout(() => void findMusic(mq.trim() || "top hits 2026"), mq ? 450 : 0);
    return () => clearTimeout(t);
  }, [mq, !!draft, draft?.music, findMusic]); // eslint-disable-line react-hooks/exhaustive-deps
  const [muted, setMuted] = useState(false);
  async function add() {
    if (!draft) return;
    const { file, music } = draft;
    setBusy(true);
    try {
      const media_url = await uploadImage(file, "story");
      const music_url = music?.preview ?? null;
      const music_title = music ? `${music.title} · ${music.artist}`.slice(0, 120) : null;
      const { error } = await supabase.from("stories" as never).insert({ author_id: userId, media_url, media_type: file.type.startsWith("video/") ? "video" : "image", music_url, music_title } as never);
      if (error) throw error;
      URL.revokeObjectURL(draft.preview); setDraft(null); setResults(null); setMq("");
      await load();
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("stories" as never).delete().eq("id", id);
    if (error) return onError(error.message);
    setOpen(null); void load();
  }

  const cur = open ? groups[open.g]?.items[open.i] : null;
  const [viewers, setViewers] = useState<{ viewer_id: string; reaction: string | null; viewer: Author }[] | null>(null);
  const [msg, setMsg] = useState("");
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [sent, setSent] = useState("");

  useEffect(() => {
    setViewers(null); setMsg(""); setSent(""); setMyReaction(null);
    if (!cur) return;
    if (cur.author_id !== userId) {
      void supabase.from("story_views" as never).upsert({ story_id: cur.id, viewer_id: userId } as never, { onConflict: "story_id,viewer_id", ignoreDuplicates: true });
    }
  }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadViewers() {
    if (!cur) return;
    const { data, error } = await supabase.from("story_views" as never)
      .select("viewer_id, reaction, viewer:profiles!story_views_viewer_id_fkey(id, display_name, username, avatar_url)")
      .eq("story_id", cur.id).order("created_at", { ascending: false });
    if (error) return onError(error.message);
    setViewers((data ?? []) as never);
  }

  async function react(emoji: string) {
    if (!cur) return;
    setMyReaction(emoji);
    const { error } = await supabase.from("story_views" as never).upsert({ story_id: cur.id, viewer_id: userId, reaction: emoji } as never, { onConflict: "story_id,viewer_id" });
    if (error) return onError(error.message);
    await supabase.from("direct_messages").insert({ sender_id: userId, recipient_id: cur.author_id, content: `${emoji} replied to your story` });
    setSent("Reaction sent");
  }

  async function sendMsg() {
    if (!cur || !msg.trim()) return;
    const { error } = await supabase.from("direct_messages").insert({ sender_id: userId, recipient_id: cur.author_id, content: `Balasan story: ${msg.trim()}` });
    if (error) return onError(error.message);
    setMsg(""); setSent("Message sent");
  }
  const paused = viewers !== null || msg.length > 0;
  const next = () => {
    if (!open || !groups[open.g]) return;
    const g = groups[open.g]!;
    if (open.i + 1 < g.items.length) setOpen({ g: open.g, i: open.i + 1 });
    else if (open.g + 1 < groups.length) setOpen({ g: open.g + 1, i: 0 });
    else setOpen(null);
  };

  useEffect(() => {
    if (!cur || cur.media_type !== "image" || paused) return;
    const timer = setTimeout(next, 5000);
    return () => clearTimeout(timer);
  });

  return (
    <>
      <section aria-label="Story" className="glass-panel flex gap-3 overflow-x-auto rounded-[24px] border border-surface/80 p-3">
        <label className={`flex w-16 shrink-0 cursor-pointer flex-col items-center gap-1 ${busy ? "opacity-50" : ""}`} aria-label="Add story">
          <span className="grid size-14 place-items-center rounded-full border-2 border-dashed border-primary/60 text-primary"><Plus className="size-6" /></span>
          <span className="w-full truncate text-center text-[11px] text-muted-foreground">{busy ? "Uploading…" : "Story"}</span>
          <input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setDraft({ file: f, preview: URL.createObjectURL(f), music: null }); }} />
        </label>
        {groups.map((g, gi) => (
          <button key={g.authorId} onClick={() => setOpen({ g: gi, i: 0 })} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className="rounded-full bg-primary p-[2px]"><span className="block rounded-full bg-background p-[2px]"><Avatar profile={g.author} size={48} /></span></span>
            <span className="w-full truncate text-center text-[11px]">{g.authorId === userId ? "You" : displayName(g.author)}</span>
          </button>
        ))}
      </section>

      {draft && createPortal((
        <div role="dialog" aria-modal="true" aria-label="New story" className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="relative flex h-full w-full max-w-[480px] flex-col overflow-hidden sm:my-4 sm:h-[calc(100%-2rem)] sm:rounded-2xl">
            <div className="flex shrink-0 flex-col gap-2 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-white">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => { URL.revokeObjectURL(draft.preview); setDraft(null); }} className="shrink-0 rounded-full bg-black/40 px-4 py-2 text-sm">Cancel</button>
                <button type="button" disabled={busy} onClick={() => void add()} className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Uploading…" : "Share"}</button>
              </div>
              {draft.music ? (
                <div className="flex items-center gap-2 rounded-full bg-white/15 py-1.5 pl-1.5 pr-4 text-sm backdrop-blur">
                  <img src={draft.music.artwork} alt="" className="size-8 shrink-0 rounded-full" />
                  <span className="min-w-0 flex-1 truncate">🎵 {draft.music.title} · {draft.music.artist}</span>
                  <button type="button" onClick={() => setDraft({ ...draft, music: null })} className="shrink-0 text-xs underline">Change</button>
                </div>
              ) : (
                <>
                  <form onSubmit={(e) => { e.preventDefault(); void findMusic(mq); }} className="flex items-center gap-2 rounded-full bg-white/15 py-2 pl-4 pr-1.5 text-sm backdrop-blur">
                    <span aria-hidden>🎵</span>
                    <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Search music (song or artist)" aria-label="Search music" className="min-w-0 flex-1 bg-transparent placeholder:text-white/60 focus:outline-none" />
                    <button type="submit" disabled={searching} className="shrink-0 rounded-full bg-white/20 px-4 py-1.5 text-xs">{searching ? "Searching…" : "Search"}</button>
                  </form>
                  {searchErr && <p className="rounded-xl bg-destructive/80 px-3 py-2 text-xs">{searchErr}</p>}
                  {!mq && results && results.length > 0 && <p className="px-1 text-xs text-white/70">Popular songs</p>}
                  {results && (
                    <ul className="max-h-44 overflow-y-auto rounded-2xl bg-white/10 p-1 backdrop-blur">
                      {results.length === 0 && <li className="p-3 text-sm text-white/70">No songs found.</li>}
                      {results.map((t) => (
                        <li key={t.id}>
                          <button type="button" onClick={() => { setDraft({ ...draft, music: t }); setResults(null); }} className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-white/10">
                            <img src={t.artwork} alt="" className="size-10 shrink-0 rounded-md" />
                            <span className="min-w-0"><span className="block truncate text-sm font-medium">{t.title}</span><span className="block truncate text-xs text-white/70">{t.artist}</span></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
            <div className="relative min-h-0 flex-1">
              {draft.file.type.startsWith("video/")
                ? <video src={draft.preview} autoPlay loop muted={!!draft.music} playsInline className="h-full w-full object-contain" />
                : <img src={draft.preview} alt="Story preview" className="h-full w-full object-contain" />}
              {draft.music && <audio key={draft.music.id} src={draft.music.preview} autoPlay loop />}
            </div>
          </div>
        </div>
      ), document.body)}

      {cur && open && createPortal((
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="relative flex h-[100dvh] w-full max-w-[480px] items-center justify-center overflow-hidden sm:my-4 sm:h-[calc(100%-2rem)] sm:rounded-2xl">
            {cur.media_type === "video"
              ? <video key={`bg-${cur.id}`} src={cur.media_url} aria-hidden muted playsInline className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl" />
              : <img key={`bg-${cur.id}`} src={cur.media_url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl" />}
            {cur.media_type === "video"
              ? <video key={cur.id} src={cur.media_url} autoPlay playsInline muted={!!cur.music_url} onEnded={next} className="relative z-[1] max-h-full max-w-full object-contain" />
              : <img key={cur.id} src={cur.media_url} alt="Story" className="relative z-[1] max-h-full max-w-full object-contain" />}
            {cur.music_url && <audio key={`m-${cur.id}`} src={cur.music_url} autoPlay loop muted={muted} />}
            {cur.music_url && (
              <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute music" : "Mute music"} className="absolute left-3 top-20 z-20 flex max-w-[75%] items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs text-white backdrop-blur">
                <span aria-hidden>{muted ? "🔇" : "🎵"}</span><span className="truncate">{cur.music_title || "Music"}</span>
              </button>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute inset-x-0 top-0 z-10 flex gap-1 px-3 pt-3">
              {groups[open.g]!.items.map((s, i) => <span key={s.id} className={`h-1 flex-1 rounded-full ${i <= open.i ? "bg-white" : "bg-white/40"}`} />)}
            </div>
            <div className="absolute inset-x-0 top-6 z-10 flex items-center gap-2.5 px-3 text-white">
              <span className="rounded-full ring-2 ring-white/70"><Avatar profile={groups[open.g]!.author} size={40} /></span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold drop-shadow">{cur.author_id === userId ? "Your story" : displayName(groups[open.g]!.author)}</span>
                <span className="text-xs text-white/80 drop-shadow">{timeAgo(cur.created_at)}</span>
              </span>
              <span className="ml-auto flex gap-1">
                {cur.author_id === userId && <button aria-label="Delete story" onClick={() => { if (confirm("Delete this story?")) void remove(cur.id); }} className="grid size-9 place-items-center rounded-full bg-black/30 hover:bg-black/50"><Trash2 className="size-5" /></button>}
                <button aria-label="Close" onClick={() => setOpen(null)} className="grid size-9 place-items-center rounded-full bg-black/30 hover:bg-black/50"><X className="size-5" /></button>
              </span>
            </div>
          </div>
          <button aria-label="Next" onClick={next} className="absolute inset-y-20 right-0 z-[5] w-1/3" />
          <button aria-label="Previous" onClick={() => setOpen(open.i > 0 ? { g: open.g, i: open.i - 1 } : open.g > 0 ? { g: open.g - 1, i: 0 } : open)} className="absolute inset-y-20 left-0 z-[5] w-1/3" />
          <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-[480px] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-white">
            {sent && <p className="mb-2 text-center text-xs opacity-80">{sent}</p>}
            {cur.author_id === userId ? (
              <button onClick={() => void loadViewers()} className="mx-auto flex items-center gap-2 rounded-full bg-background/20 px-4 py-2 text-sm"><Eye className="size-4" />See who viewed</button>
            ) : (
              <>
                <div className="mb-2 flex justify-center gap-2">
                  {["❤️", "🔥", "😂", "😮", "👏", "🚀"].map((e) => (
                    <button key={e} aria-label={`React ${e}`} onClick={() => void react(e)} className={`grid size-10 place-items-center rounded-full text-xl ${myReaction === e ? "bg-white/30" : "bg-white/10"}`}>{e}</button>
                  ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); void sendMsg(); }} className="flex gap-2">
                  <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} placeholder={`Reply to ${displayName(groups[open.g]!.author)}…`} className="h-11 flex-1 rounded-full border border-white/40 bg-black/20 px-4 text-sm text-white placeholder:text-white/60 outline-none" />
                  <button type="submit" aria-label="Send message" className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><Send className="size-4" /></button>
                </form>
              </>
            )}
          </div>
          {viewers && (
            <div className="absolute inset-x-0 bottom-0 z-20 mx-auto max-h-[60%] max-w-[600px] overflow-y-auto rounded-t-3xl bg-background p-4 text-foreground">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Viewed by {viewers.length}</h3>
                <button aria-label="Close list" onClick={() => setViewers(null)}><X className="size-5" /></button>
              </div>
              {viewers.length === 0 && <p className="text-sm text-muted-foreground">No viewers yet.</p>}
              {viewers.map((v) => (
                <div key={v.viewer_id} className="flex items-center gap-3 py-2">
                  <Avatar profile={v.viewer} size={36} />
                  <span className="flex-1 truncate text-sm">{displayName(v.viewer)}</span>
                  {v.reaction && <span className="text-lg">{v.reaction}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ), document.body)}
    </>
  );
}
