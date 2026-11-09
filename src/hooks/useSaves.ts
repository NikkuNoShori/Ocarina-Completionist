import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import { reportError } from "../lib/errors";
import { guestKey, ls } from "../lib/storage";
import { emptyState } from "../lib/rows";
import type { Notify } from "../components/Notify";
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
 * with live updates from anyone else who can edit it. Every failure goes through `notify`.
 */
export function useSaves(user: User | null, lists: ChecklistList[] | null, notify: Notify) {
  const [saves, setSaves] = useState<SaveFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const [loading, setLoading] = useState(false);
  const pauseLive = useRef(false);
  const activeRef = useRef<string | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  /** A write was refused: access may have changed, so re-check memberships. */
  const recheck = (e: { code?: string } | null) => { if (e?.code === "42501") refreshRef.current(); };
  activeRef.current = activeId;
  const active = saves.find(s => s.id === activeId) ?? null;
  const canEdit = !user || active?.role === "owner" || active?.role === "editor";

  /** Reload the save-file list. Returns null if it couldn't load. */
  const loadSaves = useCallback(async (): Promise<SaveFile[] | null> => {
    if (!user) return [];
    const [files, mem] = await Promise.all([
      sb.from("save_files").select("id,name,owner_id,updated_at").order("created_at"),
      sb.from("save_members").select("save_id,role").eq("user_id", user.id),
    ]);
    if (files.error || mem.error) { notify.error("load save files", files.error ?? mem.error, "Couldn't load your save files"); return null; }
    const roles = Object.fromEntries((mem.data ?? []).map(m => [m.save_id, m.role]));
    const others = (files.data ?? []).filter(f => f.owner_id !== user.id).map(f => f.id);
    const emails: Record<string, string> = {};
    const ppl = await Promise.all(others.map(id => sb.rpc("save_people", { p_save: id })));
    ppl.forEach((r, i) => {
      if (r.error) { reportError("save_people", r.error, { save: others[i] }); return; }
      const o = (r.data ?? []).find((p: { role: string }) => p.role === "owner");
      if (o) emails[others[i]] = o.email;
    });
    const list = (files.data ?? []).map(f => ({ ...f, role: f.owner_id === user.id ? "owner" : roles[f.id] ?? "viewer", owner_email: emails[f.id] })) as SaveFile[];
    setSaves(list);
    return list;
  }, [user, notify]);

  const loadProgress = useCallback(async (saveId: string | null) => {
    if (!lists) return;
    if (!saveId) { setProgress(blank(lists)); return; }
    const [p, e] = await Promise.all([
      sb.from("save_progress").select("list_id,n").eq("save_id", saveId),
      sb.from("save_edits").select("list_id,n,changes").eq("save_id", saveId),
    ]);
    if (p.error || e.error) { notify.error("load progress", p.error ?? e.error, "Couldn't load this save file's progress"); return; }
    const next = blank(lists);
    (p.data ?? []).forEach(r => next[r.list_id]?.got.add(r.n));
    (e.data ?? []).forEach(r => { if (next[r.list_id]) next[r.list_id].O[r.n] = r.changes; });
    setProgress(next);
  }, [lists, notify]);

  // Sign-in / sign-out
  useEffect(() => {
    if (!lists) return;
    if (!user) { setSaves([]); setActiveId(null); setProgress(loadGuest(lists)); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const acc = await sb.rpc("accept_my_invites");
      if (acc.error) reportError("accept invites", acc.error);
      let list = await loadSaves();
      if (list && !list.length) {
        const { error } = await sb.from("save_files").insert({ name: "My playthrough" });
        if (error) notify.error("create first save", error, "Couldn't create your first save file");
        list = await loadSaves();
      }
      const { data: st, error: stErr } = await sb.from("user_settings").select("active_save_id").eq("user_id", user.id).maybeSingle();
      if (stErr) reportError("load active save", stErr);
      if (cancelled) return;
      setActiveId((list ?? []).find(s => s.id === st?.active_save_id)?.id ?? list?.[0]?.id ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, lists, loadSaves, notify]);

  // Watch for being added to, removed from, or having your role changed on a save file
  useEffect(() => {
    if (!user) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const before = activeRef.current;
        const list = await loadSaves();
        if (!list || !before || list.some(s => s.id === before)) return;
        notify.info("You no longer have access to that save file. Switched to another one.");
        setActiveId(list[0]?.id ?? null);
      }, 400);
    };
    // New shares and role changes arrive live. Removals and renames are picked up when you return to the tab
    // (realtime can't filter deletes without exposing other people's memberships).
    const ch = sb.channel("memberships-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "save_members", filter: `user_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "save_members", filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe((status, err) => { if (status === "CHANNEL_ERROR") reportError("realtime memberships", err ?? status); });
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    refreshRef.current = refresh;
    return () => { clearTimeout(t); sb.removeChannel(ch); document.removeEventListener("visibilitychange", onVisible); };
  }, [user, loadSaves, notify]);

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
      .subscribe((status, err) => { if (status === "CHANNEL_ERROR") reportError("realtime save", err ?? status, { save: activeId }); });
    return () => { clearTimeout(t); sb.removeChannel(ch); };
  }, [user, lists, activeId, loadProgress]);

  /** Check or uncheck one row. */
  const setCollected = useCallback(async (listId: string, n: number, on: boolean) => {
    if (user && (!activeId || !canEdit)) { notify.info("This save file is view only."); return; }
    const apply = (val: boolean) => setProgress(p => {
      const st = p[listId]; if (!st) return p;
      const got = new Set(st.got); val ? got.add(n) : got.delete(n);
      const next = { ...p, [listId]: { ...st, got } };
      if (!user) saveGuest(listId, next[listId]);
      return next;
    });
    apply(on);
    if (!user) return;
    const res = on
      ? await sb.from("save_progress").upsert({ save_id: activeId, list_id: listId, n }, { onConflict: "save_id,list_id,n", ignoreDuplicates: true })
      : await sb.from("save_progress").delete().match({ save_id: activeId, list_id: listId, n });
    if (res.error) { apply(!on); notify.error("toggle collected", res.error, "Couldn't save that checkmark"); recheck(res.error); }
  }, [user, activeId, canEdit, notify]);

  /** Save the result of an edit session (only the differences are written). Returns true on success. */
  const commit = useCallback(async (listId: string, before: ListState, after: ListState): Promise<boolean> => {
    setProgress(p => ({ ...p, [listId]: after }));
    if (!user) { saveGuest(listId, after); return true; }
    if (!activeId) { notify.info("No save file selected."); return false; }
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
    const bad = (await Promise.all(jobs)).find(r => r.error);
    if (bad) { notify.error("save edits", bad.error, "Some changes didn't save"); recheck(bad.error); await loadProgress(activeId); return false; }
    return true;
  }, [user, activeId, loadProgress, notify]);

  /** Copy this browser's guest progress into the active save, then clear it. */
  const copyGuest = useCallback(async () => {
    if (!lists || !activeId) return;
    const prog: object[] = [], edits: object[] = [];
    lists.forEach(L => {
      ls.get<number[]>(guestKey(L.id, "got"), []).forEach(n => prog.push({ save_id: activeId, list_id: L.id, n }));
      Object.entries(ls.get<Record<string, RowEdit>>(guestKey(L.id, "edits"), {}) ?? {}).forEach(([n, c]) => edits.push({ save_id: activeId, list_id: L.id, n: +n, changes: c }));
    });
    if (prog.length) { const { error } = await sb.from("save_progress").upsert(prog); if (error) return notify.error("copy guest progress", error, "Couldn't copy your checkmarks"); }
    if (edits.length) { const { error } = await sb.from("save_edits").upsert(edits); if (error) return notify.error("copy guest edits", error, "Couldn't copy your edits"); }
    lists.forEach(L => { ls.del(guestKey(L.id, "got")); ls.del(guestKey(L.id, "edits")); });
    await loadProgress(activeId);
    notify.ok(`Copied ${prog.length} checkmarks into “${active?.name ?? "your save"}”.`);
  }, [lists, activeId, active, loadProgress, notify]);

  /** Mark rows collected from an imported CSV. Returns true on success. */
  const importCollected = useCallback(async (listId: string, ns: number[]) => {
    if (!activeId) return false;
    const { error } = await sb.from("save_progress").upsert(ns.map(n => ({ save_id: activeId, list_id: listId, n })));
    if (error) { notify.error("import csv", error, "Couldn't import that file"); return false; }
    await loadProgress(activeId);
    return true;
  }, [activeId, loadProgress, notify]);

  return {
    saves, active, activeId, setActiveId, progress, setProgress, loading, canEdit,
    loadSaves, setCollected, commit, copyGuest, importCollected,
    pauseLive: (on: boolean) => { pauseLive.current = on; },
  };
}
