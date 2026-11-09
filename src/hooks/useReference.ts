import { useCallback, useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { reportError } from "../lib/errors";
import type { ChecklistList, ItemRow, Source, SourceNote } from "../lib/types";

export interface Reference { lists: ChecklistList[]; sources: Source[]; notes: SourceNote[] }

/** The shared checklist data everyone reads (lists, items, sources, notes). */
export function useReference() {
  const [data, setData] = useState<Reference | null>(null);
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
      const items = i.data as ItemRow[];
      const lists: ChecklistList[] = (l.data ?? []).map(L => {
        const rows = items.filter(r => r.list_id === L.id);
        const areaIdx: Record<string, number> = {};
        rows.forEach(r => { if (!(r.area in areaIdx)) areaIdx[r.area] = Object.keys(areaIdx).length; });
        const byArea = [...rows].sort((a, b) => areaIdx[a.area] - areaIdx[b.area] || a.n - b.n).map(r => r.n).join();
        return { ...L, rows, areaIdx, sortable: !!L.item_groups || byArea !== rows.map(r => r.n).join() } as ChecklistList;
      });
      setData({ lists, sources: (s.data ?? []) as Source[], notes: (n.data ?? []) as SourceNote[] });
    } catch (e) {
      reportError("load checklists", e);
      setError(e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, error, retry: load };
}
