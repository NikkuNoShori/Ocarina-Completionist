import type { ChecklistList, ListState, Progress, RowEdit } from "./types";

/**
 * "All checklists": every list's rows in one virtual list, so the normal table, filters and
 * grouping work across lists. Row numbers are encoded as listIndex * 1000 + n so they stay
 * unique; `decode` maps a row back to its real list for checkmarks.
 */
export const ALL_ID = "all";
const K = 1000;

export interface AllList {
  list: ChecklistList;
  decode: (n: number) => { listId: string; n: number; name: string };
  /** Short label for a row, e.g. "Gold Skulltula #37" */
  tag: (n: number) => string;
}

// "Gold Skulltulas" → "Gold Skulltula", "Big Poes" → "Big Poe", "Gear & Items" stays as is
const singular = (name: string) => name.replace(/ies$/, "y").replace(/(Poe|Piece|Bottle|Song|Fairie|Upgrade|Skulltula)s$/, "$1").replace(/ Soil$/, " Soil");

export function buildAll(lists: ChecklistList[]): AllList {
  // Areas in roughly map order: the biggest list (Skulltulas) first, then anything the others add
  const areaIdx: Record<string, number> = {};
  [...lists].sort((a, b) => b.rows.length - a.rows.length).forEach(L =>
    Object.keys(L.areaIdx).sort((x, y) => L.areaIdx[x] - L.areaIdx[y]).forEach(a => { if (!(a in areaIdx)) areaIdx[a] = Object.keys(areaIdx).length; }));

  const rows = lists.flatMap((L, i) => L.rows.map(r => ({ ...r, list_id: ALL_ID, n: (i + 1) * K + r.n, item_group: L.name })));
  const list: ChecklistList = {
    id: ALL_ID, name: "All checklists", noun: "things", req_label: "Requires", sort_order: 0,
    sub: "Everything from every checklist in one place. Pick an area, age or time of day to see all there is to do there.",
    foot: "", item_groups: lists.map(L => L.name), rows, areaIdx, sortable: false,
  };
  const decode = (n: number) => { const L = lists[Math.floor(n / K) - 1]; return { listId: L?.id ?? "", n: n % K, name: L?.name ?? "" }; };
  const tag = (n: number) => { const d = decode(n); return `${singular(d.name)} #${d.n}`; };
  return { list, decode, tag };
}

/** The open save's checkmarks and edits for every list, renumbered for the combined list. */
export function combineState(lists: ChecklistList[], progress: Progress): ListState {
  const got = new Set<number>(), O: Record<number, RowEdit> = {};
  lists.forEach((L, i) => {
    const s = progress[L.id];
    if (!s) return;
    s.got.forEach(n => got.add((i + 1) * K + n));
    Object.entries(s.O).forEach(([n, e]) => { O[(i + 1) * K + Number(n)] = e; });
  });
  return { got, O };
}
