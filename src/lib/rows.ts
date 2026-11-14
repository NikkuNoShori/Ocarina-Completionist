import type { AgeFilter, EffRow, ItemRow, ListState, RowEdit, TimeFilter } from "./types";

export const DUNGEONS = new Set([
  "Inside the Deku Tree", "Dodongo's Cavern", "Jabu-Jabu's Belly", "Forest Temple", "Fire Temple", "Ice Cavern",
  "Water Temple", "Bottom of the Well", "Shadow Temple", "Spirit Temple", "Ganon's Castle",
]);

const baseTime = (r: ItemRow) => r.time_of_day ?? (r.night ? "Night" : "Any");

export function baseOf(r: ItemRow): Required<RowEdit> {
  return { a: r.area, l: r.location, lv: r.map_level ?? "", age: r.age, time: baseTime(r), note: r.notes, af: r.adult_first ? "1" : "0" };
}

const time = (s: string | null | undefined) => (s ? Date.parse(s) || 0 : 0);

/**
 * True when this save edited the row and the shared row has changed since that edit was made or reviewed,
 * and the edit still differs from the shared row on at least one field.
 */
export function isStale(r: ItemRow, st: ListState): boolean {
  const o = st.O[r.n];
  if (!o || !r.updated_at) return false;
  if (time(r.updated_at) <= time(st.T?.[r.n])) return false;
  const base = baseOf(r) as Record<string, string>;
  return Object.entries(o).some(([k, v]) => base[k] !== v);
}

/** Field-by-field: this save's value next to the shared one, for every field the save changed. */
export const FIELD_NAMES: Record<keyof RowEdit, string> = { a: "Area", l: "Location", lv: "Floor", age: "Age", time: "Time", note: "Requirements", af: "Adult first" };
export function showValue(k: keyof RowEdit, v: string | undefined): string {
  if (k === "af") return v === "1" ? "Yes" : "No";
  if (k === "lv" && v === "?") return "Not known yet";
  return v ? v : "—";
}
export function fieldDiff(r: ItemRow, o: RowEdit | undefined): { k: keyof RowEdit; base: string; mine: string }[] {
  const base = baseOf(r);
  return (Object.keys(o ?? {}) as (keyof RowEdit)[])
    .filter(k => o![k] !== base[k])
    .map(k => ({ k, base: base[k], mine: o![k] as string }));
}

export function eff(r: ItemRow, st: ListState): EffRow {
  const o = st.O[r.n] ?? {};
  return {
    n: r.n,
    a: o.a ?? r.area,
    l: o.l ?? r.location,
    lv: o.lv ?? (r.map_level ?? ""),
    age: (o.age ?? r.age) as EffRow["age"],
    time: (o.time ?? baseTime(r)) as EffRow["time"],
    note: o.note ?? r.notes,
    af: o.af != null ? o.af === "1" : r.adult_first,
    group: r.item_group,
    links: r.photo_links ?? [],
    steps: Array.isArray(r.steps) ? r.steps.filter(x => typeof x === "string") : [],
    edited: !!st.O[r.n],
    stale: isStale(r, st),
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

export const emptyState = (): ListState => ({ got: new Set(), O: {}, T: {} });
export const cloneState = (s: ListState): ListState => ({ got: new Set(s.got), O: JSON.parse(JSON.stringify(s.O)), T: { ...(s.T ?? {}) } });
