import { useState } from "react";
import type { User } from "@supabase/supabase-js";

/** The profile photo from Google sign-in (Supabase stores it as avatar_url / picture), if there is one. */
export function photoOf(user: User | null): string | null {
  const m = (user?.user_metadata ?? {}) as { avatar_url?: string; picture?: string };
  return m.avatar_url || m.picture || null;
}

/** A name to show for the signed-in person before their profile loads. */
export function nameOf(user: User | null): string {
  const m = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  return m.full_name || m.name || user?.email?.split("@")[0] || "";
}

/** Round avatar: the Google photo when available, otherwise the first letter. */
export function Avatar({ user, label, className }: { user: User | null; label?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = photoOf(user);
  const letter = (label || nameOf(user) || "?")[0]?.toUpperCase() ?? "?";
  return (
    <span className={"av" + (className ? " " + className : "") + (user ? " in" : "")} aria-hidden="true">
      {src && !broken
        // Google photo URLs refuse requests that carry a referrer, so don't send one
        ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : letter}
    </span>
  );
}
