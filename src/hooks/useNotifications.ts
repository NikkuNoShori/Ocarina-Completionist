import { useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import { reportError } from "../lib/errors";
import type { Notify } from "../components/Notify";

interface Row { id: number; kind: "save_shared" | "role_changed"; payload: { save_id: string; save_name?: string; by?: string; role?: string } }

/**
 * In-app notices, e.g. "Alex shared “Run 2” with you", with an Open button.
 * Unread ones show when you sign in; new ones show live. Each is marked read once shown.
 * `quiet` skips showing them (the invite welcome step already says the same thing) but still marks them read.
 */
export function useNotifications(user: User | null, notify: Notify, openSave: (id: string) => void, quiet: boolean) {
  const shown = useRef(new Set<number>());
  const openRef = useRef(openSave); openRef.current = openSave;
  const quietRef = useRef(quiet); quietRef.current = quiet;

  useEffect(() => {
    if (!user) { shown.current.clear(); return; }
    const show = (rows: Row[]) => {
      const fresh = rows.filter(r => !shown.current.has(r.id));
      if (!fresh.length) return;
      fresh.forEach(r => shown.current.add(r.id));
      if (!quietRef.current) fresh.forEach(r => {
        const p = r.payload, save = `“${p.save_name ?? "a playthrough"}”`, by = p.by ?? "Someone";
        const text = r.kind === "save_shared"
          ? `${by} shared ${save} with you${p.role === "viewer" ? " (view only)" : ""}.`
          : `${by} changed your access to ${save}: you can now ${p.role === "editor" ? "edit it" : "only view it"}.`;
        notify.info(text, { label: "Open", run: () => openRef.current(p.save_id) });
      });
      sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", fresh.map(r => r.id))
        .then(({ error }) => { if (error) reportError("mark notifications read", error); });
    };

    sb.from("notifications").select("id,kind,payload").eq("user_id", user.id).is("read_at", null)
      .order("created_at").limit(10)
      .then(({ data, error }) => { if (error) reportError("load notifications", error); else show((data ?? []) as Row[]); });

    const ch = sb.channel("notifications-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        payload => show([payload.new as Row]))
      .subscribe((status, err) => { if (status === "CHANNEL_ERROR") reportError("realtime notifications", err ?? status); });
    return () => { sb.removeChannel(ch); };
  }, [user, notify]);
}
