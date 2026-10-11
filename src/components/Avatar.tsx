import { useEffect, useState } from "react";
import { displayName, type Author, type Profile } from "@/lib/social";

export function Avatar({ profile, size = 40 }: { profile: Author | Profile | null; size?: number }) {
  const label = displayName(profile);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [profile?.avatar_url]);
  return profile?.avatar_url && !failed ? (
    <img src={profile.avatar_url} alt={label} width={size} height={size} onError={() => setFailed(true)} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover ring-1 ring-border" />
  ) : (
    <span style={{ width: size, height: size, fontSize: size * 0.4 }} className="grid shrink-0 place-items-center rounded-full bg-primary font-display font-semibold text-primary-foreground">
      {label.charAt(0).toUpperCase()}
    </span>
  );
}
