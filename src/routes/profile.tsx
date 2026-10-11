import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Camera, Share2, LogOut, Mail, Pencil, WalletCards } from "lucide-react";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { IdentityBadges } from "@/components/IdentityBadges";
import { FollowStats, ProfileFollowButton } from "@/components/FollowLists";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/upload";
import { signOutEverywhere } from "@/lib/sign-out";
import { usePreferences } from "@/lib/preferences";
import { supabase } from "@/integrations/supabase/client";
import { profileLink, shareLink } from "@/lib/share";
import { displayName, fetchPosts, handle, joined, resizeImage, short, type Post, type Profile } from "@/lib/social";

export const Route = createFileRoute("/profile")({
  staticData: { sitemap: false },
  validateSearch: z.object({ id: z.string().uuid().optional(), u: z.string().max(40).optional() }),
  head: () => ({
    meta: [
      { title: "Profile — Mindcaster" },
      { name: "description", content: "Mindcaster profile: bio, username, photo, posts, and reminds." },
      { property: "og:title", content: "Profile — Mindcaster" },
      { property: "og:description", content: "View profiles, posts, and reposts on Mindcaster." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfileRoute,
});


function ProfileRoute() {
  const { id, u: username } = Route.useSearch();
  const [resolved, setResolved] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!username || id) return;
    void supabase.from("profiles").select("id").ilike("username", username.replace(/[%_]/g, "\\$&")).maybeSingle().then(({ data }) => setResolved(data?.id ?? null));
  }, [username, id]);
  return <AppShell title="Profile">{(u) => {
    if (username && !id) {
      if (resolved === undefined) return <p className="py-10 text-center text-sm text-muted-foreground">Loading profile…</p>;
      if (resolved === null) return <p className="py-10 text-center text-sm text-muted-foreground">User @{username} not found.</p>;
      return <ProfileView key={resolved} user={u} profileId={resolved} />;
    }
    return <ProfileView key={id ?? u.id} user={u} profileId={id ?? u.id} />;
  }}</AppShell>;
}

function ProfileView({ user, profileId }: { user: User; profileId: string }) {
  const isMe = profileId === user.id;
  const { t } = usePreferences();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"posts" | "reposts">("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id, display_name, username, bio, avatar_url, created_at").eq("id", profileId).maybeSingle();
    let wallet_address: string | null = null;
    if (data && isMe) { const { data: w } = await supabase.rpc("get_my_wallet"); wallet_address = w?.[0]?.wallet_address ?? null; }
    setProfile(data ? ({ ...data, wallet_address } as Profile) : null);
  }, [profileId, isMe]);

  const loadPosts = useCallback(async () => {
    try {
      if (tab === "posts") setPosts(await fetchPosts({ authorId: profileId }));
      else {
        const { data } = await supabase.from("post_reposts").select("post_id").eq("user_id", profileId).order("created_at", { ascending: false }).limit(50);
        setPosts(await fetchPosts({ ids: (data ?? []).map((r) => r.post_id) }));
      }
    } catch (e) { setError((e as Error).message); }
  }, [tab, profileId]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);
  useEffect(() => { void loadPosts(); }, [loadPosts]);


  if (!profile) return <p className="py-10 text-center text-sm text-muted-foreground">Loading profile…</p>;

  return (
    <>
      <section className="glass-panel overflow-hidden rounded-[24px] border border-surface/80">
        <div className="h-24 bg-gradient-to-r from-primary/60 via-primary/25 to-surface" />
        <div className="px-4 pb-4">
          <div className="-mt-10 flex items-end justify-between">
            <div className="rounded-full ring-4 ring-background"><Avatar profile={profile} size={80} /></div>
            <div className="flex gap-2">
              {isMe ? (
                <>
                  <Button variant="surface" size="sm" onClick={() => setEditing((v) => !v)}><Pencil className="size-4" />{t("editProfile")}</Button>
                  <Button variant="ghost" size="icon" aria-label={t("signOut")} onClick={() => void (async () => { await signOutEverywhere(); window.location.replace("/"); })()}><LogOut className="size-4" /></Button>
                </>
              ) : (
                <>
                  <ProfileFollowButton profileId={profile.id} />
                  <Button asChild variant="surface" size="sm"><Link to="/messages" search={{ with: profile.id }}><Mail className="size-4" />Message</Link></Button>
                </>
              )}
              <Button variant="ghost" size="icon" aria-label={t("shareProfile")} onClick={() => void shareLink(profileLink(profile.id), displayName(profile))}><Share2 className="size-4" /></Button>
            </div>
          </div>
          <h2 className="mt-3 flex items-center gap-1.5 font-display text-xl font-semibold">{displayName(profile)}<IdentityBadges username={profile.username} /></h2>
          {handle(profile) ? <p className="text-sm text-muted-foreground">{handle(profile)}</p> : isMe && <p className="text-sm text-muted-foreground">{t("noUsername")}</p>}
          {profile.bio && <p className="mt-2 whitespace-pre-wrap text-sm">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />Joined {joined(profile.created_at)}</span>
            {profile.wallet_address && <span className="flex items-center gap-1 text-primary"><WalletCards className="size-3.5" />{short(profile.wallet_address)}</span>}
          </div>
          <FollowStats profileId={profile.id} userId={user.id} />
        </div>
      </section>

      {editing && isMe && <EditProfile profile={profile} onDone={() => { setEditing(false); void loadProfile(); void loadPosts(); }} />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="glass-panel grid grid-cols-2 rounded-full border border-surface/80 p-1">
        {(["posts", "reposts"] as const).map((key) => (
          <button key={key} onClick={() => setTab(key)} className={`rounded-full py-2 text-sm font-semibold transition ${tab === key ? "bg-surface shadow-tab" : "text-muted-foreground"}`}>{key === "posts" ? t("posts") : t("repost")}</button>
        ))}
      </div>
      {posts.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No {tab === "posts" ? "posts" : "reminds"} yet.</p>}
      {posts.map((p) => <PostCard key={p.id} post={p} userId={user.id} onChange={loadPosts} onError={setError} />)}
    </>
  );
}

function EditProfile({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [name, setName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = usePreferences();

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const u = username.trim();
    if (u && !/^[a-zA-Z0-9_]{3,20}$/.test(u)) return setError("Username must be 3–20 characters: letters, numbers, or _.");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() || null, username: u || null, bio: bio.trim() || null, avatar_url: avatar }).eq("id", profile.id);
    setSaving(false);
    if (error) return setError(error.code === "23505" ? "Username is already taken." : /reserved/i.test(error.message) ? "This username is reserved. Please choose another one (4+ characters, not a brand name)." : error.message);
    onDone();
  }

  async function pick(file?: File) {
    if (!file) return;
    setError(null); setSaving(true);
    try { setAvatar(await uploadImage(file, "avatar")); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  const field = "h-10 w-full rounded-xl border border-border/60 bg-surface/75 px-3 text-sm outline-none focus:border-primary";
  return (
    <form onSubmit={save} className="glass-panel space-y-3 rounded-[24px] border border-surface/80 p-4">
      <div className="flex items-center gap-3">
        <Avatar profile={{ ...profile, avatar_url: avatar }} size={56} />
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-surface/70 px-3 py-1.5 text-xs font-semibold">
          <Camera className="size-4" />{t("changePhoto")}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {avatar && <button type="button" onClick={() => setAvatar(null)} className="text-xs text-muted-foreground underline">{t("remove")}</button>}
      </div>
      <label className="block"><span className="mb-1 block text-xs font-semibold text-foreground/70">{t("name")}</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} className={field} /></label>
      <label className="block"><span className="mb-1 block text-xs font-semibold text-foreground/70">Username</span>
        <span className="relative block"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span><input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} placeholder="username" className={`${field} pl-7`} /></span>
      </label>
      <label className="block"><span className="mb-1 block text-xs font-semibold text-foreground/70">{t("bio")}</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} className={`${field} h-auto resize-none py-2`} /><span className="text-xs text-muted-foreground">{bio.length}/160</span></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
