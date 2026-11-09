import type { AgeFilter, EffRow, ItemRow, ListState, RowEdit, TimeFilter } from "./types";

export const DUNGEONS = new Set([
  "Inside the Deku Tree", "Dodongo's Cavern", "Jabu-Jabu's Belly", "Forest Temple", "Fire Temple", "Ice Cavern",
  "Water Temple", "Bottom of the Well", "Shadow Temple", "Spirit Temple", "Ganon's Castle",
]);

export function baseOf(r: ItemRow): Required<RowEdit> {
  return { a: r.area, l: r.location, lv: r.map_level ?? "", age: r.age, time: r.night ? "Night" : "Any", note: r.notes, af: r.adult_first ? "1" : "0" };
}

export function eff(r: ItemRow, st: ListState): EffRow {
  const o = st.O[r.n] ?? {};
  return {
    n: r.n,
    a: o.a ?? r.area,
    l: o.l ?? r.location,
    lv: o.lv ?? (r.map_level ?? ""),
    age: (o.age ?? r.age) as EffRow["age"],
    time: (o.time ?? (r.night ? "Night" : "Any")) as EffRow["time"],
    note: o.note ?? r.notes,
    af: o.af != null ? o.af === "1" : r.adult_first,
    group: r.item_group,
    links: r.photo_links ?? [],
    edited: !!st.O[r.n],
  };
}

/** Apply one field change and keep only what differs from the reference row. */
export function applyEdit(r: ItemRow, current: RowEdit | undefined, field: keyof RowEdit, value: string): RowEdit | undefined {
  const base = baseOf(r);
  const c: Record<string, string> = { ...base, ...(current ?? {}) };
  c[field] = value;
  if (field === "lv" && c.lv === "" && base.lv === "?") c.lv = "?";
  if (field === "a" && !c.a) c.a = base.a;
  const diff: Record<string, string> = {};
  for (const k of Object.keys(c)) if (c[k] !== (base as Record<string, string>)[k]) diff[k] = c[k];
  return Object.keys(diff).length ? (diff as RowEdit) : undefined;
}

export const ageOK = (r: EffRow, f: AgeFilter) =>
  f === "all" ? true : f === "travel" ? r.af : !r.af && (r.age === f || r.age === "Either" || r.age === "Both");
export const timeOK = (r: EffRow, t: TimeFilter) => (t === "all" ? true : t === "Night" ? r.time === "Night" : r.time !== "Night");

export const countGot = (rows: EffRow[], got: Set<number>) => rows.filter(r => got.has(r.n)).length;

export const emptyState = (): ListState => ({ got: new Set(), O: {} });
export const cloneState = (s: ListState): ListState => ({ got: new Set(s.got), O: JSON.parse(JSON.stringify(s.O)) });
