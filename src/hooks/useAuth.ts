import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";

/** Signed-in user (or null), whether the session check finished, and password-recovery mode. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setUser(prev => (prev?.id === session?.user?.id ? prev : session?.user ?? null));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, ready, recovering, setRecovering };
}
