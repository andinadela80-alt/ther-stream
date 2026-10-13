import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, ChevronDown, Share2, Flag, Heart, MessageCircle, MoreHorizontal, Pencil, Repeat2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar } from "@/components/Avatar";
import { RichText } from "@/components/RichText";
import { IdentityBadges } from "@/components/IdentityBadges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useFollows } from "@/lib/follows";
import { usePreferences } from "@/lib/preferences";
import { postLink, shareLink } from "@/lib/share";
import { REACTIONS, displayName, handle, short, timeAgo, type Post } from "@/lib/social";

export function PostCard({ post: p, userId, onChange, onError, detail = false }: { post: Post; userId: string; onChange: () => void; onError: (m: string) => void; detail?: boolean }) {
  const navigate = useNavigate();
  const { following, pending, toggleFollow } = useFollows();
  const { t } = usePreferences();
  const [showComments, setShowComments] = useState(detail);
  const [showReact, setShowReact] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const reactionPending = useRef(false);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(p.content);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("spam");
  const liked = p.post_likes.some((l) => l.user_id === userId);
  const reposted = p.post_reposts.some((l) => l.user_id === userId);
  const bookmarked = p.post_bookmarks.some((l) => l.user_id === userId);
  const myReaction = p.post_reactions.find((r) => r.user_id === userId)?.emoji;
  const totalReactions = p.post_likes.length + p.post_reactions.length;

  async function run(q: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await q;
    if (error) onError(error.message); else onChange();
  }
  function clearPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressOrigin.current = null;
  }
  function startPress(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    clearPress();
    longPressed.current = false;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setShowReact(true);
      clearPress();
    }, 450);
  }
  function movePress(e: PointerEvent<HTMLButtonElement>) {
    if (pressOrigin.current && Math.hypot(e.clientX - pressOrigin.current.x, e.clientY - pressOrigin.current.y) > 10) clearPress();
  }
  async function chooseReaction(emoji: string | null) {
    if (reactionPending.current) return;
    reactionPending.current = true;
    setShowReact(false);
    try {
      const removing = emoji === null ? liked && !myReaction : myReaction === emoji && !liked;
      if (myReaction) {
        const { error } = await supabase.from("post_reactions").delete().eq("post_id", p.id).eq("user_id", userId);
        if (error) throw error;
      }
      if (liked) {
        const { error } = await supabase.from("post_likes").delete().eq("post_id", p.id).eq("user_id", userId);
        if (error) throw error;
      }
      if (!removing) {
        const { error } = emoji === null
          ? await supabase.from("post_likes").insert({ post_id: p.id, user_id: userId })
          : await supabase.from("post_reactions").insert({ post_id: p.id, user_id: userId, emoji });
        if (error) throw error;
      }
      onChange();
    } catch (error) {
      onError(error instanceof Error ? error.message : t("reactionFailed"));
      onChange();
    } finally {
      reactionPending.current = false;
    }
  }
  const toggleRepost = () => run(reposted ? supabase.from("post_reposts").delete().eq("post_id", p.id).eq("user_id", userId) : supabase.from("post_reposts").insert({ post_id: p.id, user_id: userId }));
  async function toggleBookmark() {
    const { error } = await (bookmarked
      ? supabase.from("post_bookmarks").delete().eq("post_id", p.id).eq("user_id", userId)
      : supabase.from("post_bookmarks").insert({ post_id: p.id, user_id: userId }));
    if (error) return onError(error.message);
    toast.success(bookmarked ? t("bookmarkRemoved") : t("postSaved"));
    onChange();
  }
  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    const { error } = await supabase.from("post_comments").insert({ post_id: p.id, author_id: userId, content: comment.trim() });
    if (error) return onError(error.message);
    setComment("");
    onChange();
  }
  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    const content = editContent.trim();
    if (!content) return;
    const { error } = await supabase.from("posts").update({ content }).eq("id", p.id).eq("author_id", userId);
    if (error) return onError(error.message);
    setEditing(false);
    toast.success(t("postUpdated"));
    onChange();
  }
  async function deletePost() {
    const { error } = await supabase.from("posts").delete().eq("id", p.id).eq("author_id", userId);
    if (error) return onError(error.message);
    toast.success(t("postDeleted"));
    onChange();
  }
  async function submitReport(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("post_reports").insert({ post_id: p.id, reporter_id: userId, reason });
    if (error) return onError(error.code === "23505" ? "You've already reported this post." : error.message);
    setReporting(false);
    toast.success(t("reportSent"), { description: t("reportThanks") });
  }

  return (
    <article
      className={`glass-panel rounded-[24px] border border-surface/80 p-4 sm:p-5 ${detail ? "" : "cursor-pointer"}`}
      onClick={detail ? undefined : (event) => {
        const target = event.target;
        if (!(target instanceof Element) || target.closest("a, button, input, textarea, select, label, form, [role=menuitem], [role=dialog]")) return;
        if (window.getSelection()?.toString()) return;
        void navigate({ to: "/post", search: { id: p.id } });
      }}
    >
      {!detail && <Link to="/post" search={{ id: p.id }} className="sr-only focus:not-sr-only focus:mb-3 focus:block focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-ring">View post by {displayName(p.author)}</Link>}
      <header className="flex items-start gap-3">
        <Link to="/profile" search={{ id: p.author_id }}><Avatar profile={p.author} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link to="/profile" search={{ id: p.author_id }} className="flex min-w-0 items-center gap-1">
              <span className="truncate font-display text-sm font-semibold">{displayName(p.author)}</span>
              <IdentityBadges username={p.author?.username} />
            </Link>
            {p.author_id !== userId && <Button type="button" variant="ghost" size="sm" disabled={pending.has(p.author_id)} onClick={() => void toggleFollow(p.author_id)} className="h-6 shrink-0 px-1.5 text-xs font-semibold text-primary">· {following.has(p.author_id) ? t("following") : t("follow")}</Button>}
            <span className="shrink-0 text-xs text-muted-foreground">· {timeAgo(p.created_at)}</span>
          </div>
          {handle(p.author) && <Link to="/profile" search={{ id: p.author_id }} className="block text-xs text-muted-foreground">{handle(p.author)}</Link>}
          {p.author?.wallet_address && <span className="text-[11px] text-primary">{short(p.author.wallet_address)}</span>}
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm"><RichText text={p.content} /></p>
          {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="mt-2 max-h-[480px] w-full rounded-2xl border border-border/60 object-cover" />}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={t("postMenu")}><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {p.author_id === userId ? (
              <>
                <DropdownMenuItem onSelect={() => { setEditContent(p.content); setEditing(true); }}><Pencil />{t("editPost")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={deletePost} className="text-destructive focus:text-destructive"><Trash2 />{t("deletePost")}</DropdownMenuItem>
              </>
            ) : <DropdownMenuItem onSelect={() => setReporting(true)} className="text-destructive focus:text-destructive"><Flag />{t("report")}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="relative mt-2 flex justify-between pl-[44px] text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => { if (detail) document.getElementById(`reply-${p.id}`)?.focus(); else void navigate({ to: "/post", search: { id: p.id } }); }} aria-label={t("comments")}><MessageCircle className="size-4" />{p.post_comments.length}</Button>
        <Button variant="ghost" size="sm" onClick={toggleRepost} aria-pressed={reposted} aria-label={t("repost")} className={reposted ? "text-primary" : ""}><Repeat2 className="size-4" />{p.post_reposts.length}</Button>
        <Popover open={showReact} onOpenChange={setShowReact}>
          <div className="flex items-center">
            <PopoverAnchor asChild>
              <Button variant="ghost" size="sm" onPointerDown={startPress} onPointerMove={movePress} onPointerUp={clearPress} onPointerCancel={clearPress} onPointerLeave={clearPress} onContextMenu={(e) => e.preventDefault()} onClick={() => { if (longPressed.current) { longPressed.current = false; return; } void chooseReaction(null); }} aria-pressed={liked || Boolean(myReaction)} aria-label={t("likePost")} className={liked || myReaction ? "text-primary touch-manipulation" : "touch-manipulation"}>
                {myReaction ? <span className="text-base leading-none" aria-hidden="true">{myReaction}</span> : <Heart className={`size-4 ${liked ? "fill-primary" : ""}`} />}
                {totalReactions}
              </Button>
            </PopoverAnchor>
            <Button variant="ghost" size="icon" className="size-6" aria-label={t("reactionChoices")} aria-expanded={showReact} onClick={() => setShowReact((open) => !open)}><ChevronDown className="size-3.5" /></Button>
          </div>
          <PopoverContent side="top" align="center" sideOffset={8} className="flex w-auto max-w-[calc(100vw-1rem)] items-center gap-0.5 rounded-full border-border bg-popover p-1.5 shadow-tab">
            <Button type="button" variant="ghost" size="icon" className={liked ? "size-9 text-primary" : "size-9"} aria-label={t("like")} aria-pressed={liked} onClick={() => void chooseReaction(null)}><Heart className={`size-5 ${liked ? "fill-primary" : ""}`} /></Button>
            {REACTIONS.map((emoji) => <Button type="button" variant="ghost" size="icon" key={emoji} className={myReaction === emoji ? "size-9 bg-accent text-lg" : "size-9 text-lg"} aria-label={`Reaksi ${emoji}`} aria-pressed={myReaction === emoji} onClick={() => void chooseReaction(emoji)}>{emoji}</Button>)}
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" onClick={() => void shareLink(postLink(p.id))} aria-label="Share"><Share2 className="size-4" /></Button>
        <Button variant="ghost" size="icon" className={bookmarked ? "text-primary" : ""} onClick={toggleBookmark} aria-pressed={bookmarked} aria-label={bookmarked ? t("removeBookmark") : t("bookmark")}><Bookmark className={`size-4 ${bookmarked ? "fill-primary" : ""}`} /></Button>
      </div>

      {(detail || showComments) && (
        <div className="mt-2 space-y-2.5 border-t border-border/60 pt-3">
          {detail && <h2 className="font-display text-sm font-semibold">Replies · {p.post_comments.length}</h2>}
          {p.post_comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-sm">
              <Avatar profile={c.author} size={28} />
              <p className="flex-1 break-words"><span className="inline-flex items-center gap-1 font-semibold">{displayName(c.author)}<IdentityBadges username={c.author?.username} /></span> <RichText text={c.content} /></p>
               {c.author_id === userId && <Button variant="ghost" size="icon" className="size-7" aria-label={t("deleteComment")} onClick={() => run(supabase.from("post_comments").delete().eq("id", c.id))}><Trash2 className="size-3.5" /></Button>}
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2">
            <input id={`reply-${p.id}`} aria-label="Post your reply" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder={detail ? "Post your reply" : t("writeComment")} className="h-9 min-w-0 flex-1 rounded-xl border border-border/60 bg-surface/75 px-3 text-sm outline-none focus:border-primary" />
            <Button type="submit" size="sm" disabled={!comment.trim()}>{t("reply")}</Button>
          </form>
        </div>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <form onSubmit={saveEdit} className="space-y-4">
            <DialogHeader><DialogTitle>{t("editPost")}</DialogTitle><DialogDescription>{t("updatePost")}</DialogDescription></DialogHeader>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} maxLength={500} rows={5} autoFocus className="w-full resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-primary" />
             <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{editContent.length}/500</span><DialogFooter className="flex-row gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>{t("cancel")}</Button><Button type="submit" size="sm" disabled={!editContent.trim()}>{t("save")}</Button></DialogFooter></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reporting} onOpenChange={setReporting}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <form onSubmit={submitReport} className="space-y-4">
            <DialogHeader><DialogTitle>{t("reportPost")}</DialogTitle><DialogDescription>{t("reportPrivate")}</DialogDescription></DialogHeader>
            <label className="block text-sm font-semibold">{t("reason")}
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 font-normal outline-none focus:border-primary">
                 <option value="spam">{t("spam")}</option><option value="harassment">{t("harassment")}</option><option value="misinformation">{t("misinformation")}</option><option value="illegal">{t("illegal")}</option><option value="other">{t("other")}</option>
              </select>
            </label>
             <DialogFooter className="flex-row justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setReporting(false)}>{t("cancel")}</Button><Button type="submit" variant="destructive" size="sm">{t("sendReport")}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </article>
  );
}
