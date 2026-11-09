import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import { reportError } from "../lib/errors";
import type { Notify } from "../components/Notify";

/** Signed-in user (or null), whether the session check finished, and password-recovery mode. */
export function useAuth(notify: Notify) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    // A failed Google sign-in or an expired email link comes back as ?error=… or #error=… in the URL.
    const params = new URLSearchParams(location.search + "&" + location.hash.replace(/^#/, ""));
    const desc = params.get("error_description");
    if (desc) {
      const msg = desc.replace(/\+/g, " ");
      reportError("auth redirect", { message: msg, code: params.get("error_code") ?? params.get("error") ?? undefined });
      notify.error("auth redirect", { message: msg }, /expired|invalid/i.test(msg) ? "That link has expired or was already used. Request a new one" : "Sign-in didn't finish");
      history.replaceState(null, "", location.pathname);
    }

    sb.auth.getSession().then(({ data, error }) => {
      if (error) notify.error("get session", error, "Couldn't restore your sign-in");
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setUser(prev => (prev?.id === session?.user?.id ? prev : session?.user ?? null));
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, ready, recovering, setRecovering };
}
