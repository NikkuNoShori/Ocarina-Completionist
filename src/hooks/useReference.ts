import { useCallback, useEffect, useRef, useState } from "react";
import { sb } from "../lib/supabase";
import { reportError } from "../lib/errors";
import { ls } from "../lib/storage";
import type { ChecklistList, ItemRow, Source, SourceNote } from "../lib/types";

export interface Reference { lists: ChecklistList[]; sources: Source[]; notes: SourceNote[] }

/** The raw rows as they come from the database (and as they're cached on the device). */
interface Raw { lists: Omit<ChecklistList, "rows" | "areaIdx" | "sortable">[]; items: ItemRow[]; sources: Source[]; notes: SourceNote[] }
const CACHE_KEY = "oot-ref-v1";

function build(raw: Raw): Reference {
  const lists: ChecklistList[] = raw.lists.map(L => {
    const rows = raw.items.filter(r => r.list_id === L.id);
    const areaIdx: Record<string, number> = {};
    rows.forEach(r => { if (!(r.area in areaIdx)) areaIdx[r.area] = Object.keys(areaIdx).length; });
    const byArea = [...rows].sort((a, b) => areaIdx[a.area] - areaIdx[b.area] || a.n - b.n).map(r => r.n).join();
    return { ...L, rows, areaIdx, sortable: !!L.item_groups || byArea !== rows.map(r => r.n).join() } as ChecklistList;
  });
  return { lists, sources: raw.sources, notes: raw.notes };
}

/**
 * The shared checklist data everyone reads (lists, items, sources, notes).
 * Stale-while-revalidate: a copy saved on this device shows instantly, then fresh data replaces it
 * only if something changed. If the network fails and there's a saved copy, the page still works.
 */
export function useReference() {
  const cached = useRef<string | null>(null);
  const [data, setData] = useState<Reference | null>(() => {
    const raw = ls.get<Raw | null>(CACHE_KEY, null);
    if (!raw?.lists?.length || !raw.items?.length) return null;
    cached.current = JSON.stringify(raw);
    return build(raw);
  });
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [l, i, s, n] = await Promise.all([
        sb.from("lists").select("*").order("sort_order"),
        sb.from("items").select("*").order("n"),
        sb.from("sources").select("*").order("sort_order"),
        sb.from("source_notes").select("*").order("id"),
      ]);
      // Lists and items are required; sources and notes can be missing without breaking the page.
      if (l.error || i.error) throw l.error ?? i.error;
      if (s.error) reportError("load sources", s.error);
      if (n.error) reportError("load source notes", n.error);
      const raw: Raw = { lists: l.data ?? [], items: (i.data ?? []) as ItemRow[], sources: (s.data ?? []) as Source[], notes: (n.data ?? []) as SourceNote[] };
      const json = JSON.stringify(raw);
      if (json === cached.current) return; // nothing changed since the saved copy
      cached.current = json;
      ls.set(CACHE_KEY, raw);
      setData(build(raw));
    } catch (e) {
      reportError("load checklists", e);
      if (!cached.current) setError(e); // with a saved copy, keep showing it
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, error, retry: load };
}
