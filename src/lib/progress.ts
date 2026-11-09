import type { ChecklistList, Progress } from "./types";

export interface Completion {
  done: number; total: number; pct: number;
  perList: { id: string; name: string; done: number; total: number; pct: number }[];
}

const pct = (d: number, t: number) => (t ? Math.floor((d / t) * 100) : 0);

/** How complete a playthrough is, overall and per list. Rounds down so 100% means truly done. */
export function completion(lists: ChecklistList[], progress: Progress): Completion {
  const perList = lists.map(L => {
    const valid = new Set(L.rows.map(r => r.n));
    const done = [...(progress[L.id]?.got ?? [])].filter(n => valid.has(n)).length;
    return { id: L.id, name: L.name, done, total: L.rows.length, pct: pct(done, L.rows.length) };
  });
  const done = perList.reduce((s, l) => s + l.done, 0), total = perList.reduce((s, l) => s + l.total, 0);
  return { done, total, pct: pct(done, total), perList };
}

export const totalItems = (lists: ChecklistList[]) => lists.reduce((s, L) => s + L.rows.length, 0);
export const percent = pct;
