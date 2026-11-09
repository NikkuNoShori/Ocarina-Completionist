import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import { guestKey, ls } from "../lib/storage";
import { emptyState } from "../lib/rows";
import type { ChecklistList, ListState, Progress, RowEdit, SaveFile } from "../lib/types";

const blank = (lists: ChecklistList[]): Progress => Object.fromEntries(lists.map(L => [L.id, emptyState()]));

function loadGuest(lists: ChecklistList[]): Progress {
  return Object.fromEntries(lists.map(L => [L.id, {
    got: new Set(ls.get<number[]>(guestKey(L.id, "got"), [])),
    O: ls.get<Record<number, RowEdit>>(guestKey(L.id, "edits"), {}) ?? {},
  }]));
}
function saveGuest(listId: string, st: ListState) {
  ls.set(guestKey(listId, "got"), [...st.got]);
  ls.set(guestKey(listId, "edits"), st.O);
}
export const hasGuestData = (lists: ChecklistList[]) =>
  lists.some(L => ls.get<number[]>(guestKey(L.id, "got"), []).length || Object.keys(ls.get(guestKey(L.id, "edits"), {}) ?? {}).length);

/**
 * Save files and progress.
 * Signed out: progress lives in this browser. Signed in: it lives in the active save file,
 * with live updates from anyone else who can edit it.
 */
export function useSaves(user: User | null, lists: ChecklistList[] | null) {
  const [saves, setSaves] = useState<SaveFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const [loading, setLoading] = useState(false);
  const pauseLive = useRef(false);
  const active = saves.find(s => s.id === activeId) ?? null;
  const canEdit = !user || active?.role === "owner" || active?.role === "editor";

  const loadSaves = useCallback(async (): Promise<SaveFile[]> => {
    if (!user) return [];
    const [{ data: files }, { data: mem }] = await Promise.all([
      sb.from("save_files").select("id,name,owner_id,updated_at").order("created_at"),
      sb.from("save_members").select("save_id,role").eq("user_id", user.id),
    ]);
    const roles = Object.fromEntries((mem ?? []).map(m => [m.save_id, m.role]));
    const others = (files ?? []).filter(f => f.owner_id !== user.id).map(f => f.id);
    const emails: Record<string, string> = {};
    const ppl = await Promise.all(others.map(id => sb.rpc("save_people", { p_save: id })));
    ppl.forEach((r, i) => { const o = (r.data ?? []).find((p: { role: string }) => p.role === "owner"); if (o) emails[others[i]] = o.email; });
    const list = (files ?? []).map(f => ({ ...f, role: f.owner_id === user.id ? "owner" : roles[f.id] ?? "viewer", owner_email: emails[f.id] })) as SaveFile[];
    setSaves(list);
    return list;
  }, [user]);

  const loadProgress = useCallback(async (saveId: string | null) => {
    if (!lists) return;
    if (!saveId) { setProgress(blank(lists)); return; }
    const [p, e] = await Promise.all([
      sb.from("save_progress").select("list_id,n").eq("save_id", saveId),
      sb.from("save_edits").select("list_id,n,changes").eq("save_id", saveId),
    ]);
    const next = blank(lists);
    (p.data ?? []).forEach(r => next[r.list_id]?.got.add(r.n));
    (e.data ?? []).forEach(r => { if (next[r.list_id]) next[r.list_id].O[r.n] = r.changes; });
    setProgress(next);
  }, [lists]);

  // Sign-in / sign-out
  useEffect(() => {
    if (!lists) return;
    if (!user) { setSaves([]); setActiveId(null); setProgress(loadGuest(lists)); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      await sb.rpc("accept_my_invites");
      let list = await loadSaves();
      if (!list.length) { await sb.from("save_files").insert({ name: "My playthrough" }); list = await loadSaves(); }
      const { data: st } = await sb.from("user_settings").select("active_save_id").eq("user_id", user.id).maybeSingle();
      const pick = list.find(s => s.id === st?.active_save_id)?.id ?? list[0]?.id ?? null;
      if (cancelled) return;
      setActiveId(pick);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, lists, loadSaves]);

  // Load the active save and listen for co-editors
  useEffect(() => {
    if (!user || !lists) return;
    loadProgress(activeId);
    if (!activeId) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { clearTimeout(t); t = setTimeout(() => { if (!pauseLive.current) loadProgress(activeId); }, 350); };
    const ch = sb.channel("save-" + activeId)
      .on("postgres_changes", { event: "*", schema: "public", table: "save_progress", filter: `save_id=eq.${activeId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "save_edits", filter: `save_id=eq.${activeId}` }, refresh)
      .subscribe();
    return () => { clearTimeout(t); sb.removeChannel(ch); };
  }, [user, lists, activeId, loadProgress]);

  /** Check or uncheck one row. Returns an error message, or null. */
  const setCollected = useCallback(async (listId: string, n: number, on: boolean): Promise<string | null> => {
    const apply = (val: boolean) => setProgress(p => {
      const st = p[listId]; if (!st) return p;
      const got = new Set(st.got); val ? got.add(n) : got.delete(n);
      const next = { ...p, [listId]: { ...st, got } };
      if (!user) saveGuest(listId, next[listId]);
      return next;
    });
    apply(on);
    if (!user) return null;
    if (!activeId || !canEdit) return "You can't change this save file.";
    const res = on
      ? await sb.from("save_progress").insert({ save_id: activeId, list_id: listId, n })
      : await sb.from("save_progress").delete().match({ save_id: activeId, list_id: listId, n });
    if (res.error && !/duplicate/i.test(res.error.message)) { apply(!on); return "Couldn't save that checkmark. Check your connection and try again."; }
    return null;
  }, [user, activeId, canEdit]);

  /** Save the result of an edit session (only the differences are written). */
  const commit = useCallback(async (listId: string, before: ListState, after: ListState): Promise<string | null> => {
    setProgress(p => ({ ...p, [listId]: after }));
    if (!user) { saveGuest(listId, after); return null; }
    if (!activeId) return "No save file selected.";
    const now = new Date().toISOString();
    const ups: object[] = [], dels: number[] = [];
    new Set([...Object.keys(before.O), ...Object.keys(after.O)]).forEach(k => {
      const n = +k;
      if (JSON.stringify(before.O[n] ?? null) !== JSON.stringify(after.O[n] ?? null))
        after.O[n] ? ups.push({ save_id: activeId, list_id: listId, n, changes: after.O[n], updated_at: now }) : dels.push(n);
    });
    const add = [...after.got].filter(n => !before.got.has(n)), rem = [...before.got].filter(n => !after.got.has(n));
    const jobs = [];
    if (ups.length) jobs.push(sb.from("save_edits").upsert(ups));
    if (dels.length) jobs.push(sb.from("save_edits").delete().eq("save_id", activeId).eq("list_id", listId).in("n", dels));
    if (add.length) jobs.push(sb.from("save_progress").upsert(add.map(n => ({ save_id: activeId, list_id: listId, n }))));
    if (rem.length) jobs.push(sb.from("save_progress").delete().eq("save_id", activeId).eq("list_id", listId).in("n", rem));
    const res = await Promise.all(jobs);
    const bad = res.find(r => r.error);
    if (bad) { await loadProgress(activeId); return "Some changes didn't save: " + bad.error!.message; }
    return null;
  }, [user, activeId, loadProgress]);

  /** Copy this browser's guest progress into the active save, then clear it. */
  const copyGuest = useCallback(async (): Promise<string> => {
    if (!lists || !activeId) return "No save file selected.";
    const prog: object[] = [], edits: object[] = [];
    lists.forEach(L => {
      ls.get<number[]>(guestKey(L.id, "got"), []).forEach(n => prog.push({ save_id: activeId, list_id: L.id, n }));
      Object.entries(ls.get<Record<string, RowEdit>>(guestKey(L.id, "edits"), {}) ?? {}).forEach(([n, c]) => edits.push({ save_id: activeId, list_id: L.id, n: +n, changes: c }));
    });
    if (prog.length) { const { error } = await sb.from("save_progress").upsert(prog); if (error) return error.message; }
    if (edits.length) { const { error } = await sb.from("save_edits").upsert(edits); if (error) return error.message; }
    lists.forEach(L => { ls.del(guestKey(L.id, "got")); ls.del(guestKey(L.id, "edits")); });
    await loadProgress(activeId);
    return `Copied ${prog.length} checkmarks into “${active?.name ?? "your save"}”.`;
  }, [lists, activeId, active, loadProgress]);

  /** Mark rows collected from an imported CSV. */
  const importCollected = useCallback(async (listId: string, ns: number[]) => {
    if (!activeId) return "No save file selected.";
    const { error } = await sb.from("save_progress").upsert(ns.map(n => ({ save_id: activeId, list_id: listId, n })));
    if (error) return error.message;
    await loadProgress(activeId);
    return null;
  }, [activeId, loadProgress]);

  return {
    saves, active, activeId, setActiveId, progress, setProgress, loading, canEdit,
    loadSaves, setCollected, commit, copyGuest, importCollected,
    pauseLive: (on: boolean) => { pauseLive.current = on; },
  };
}
