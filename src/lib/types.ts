export type Age = "Child" | "Adult" | "Either" | "Both";
export type Time = "Any" | "Day" | "Night";
export type AgeFilter = "all" | "Child" | "Adult" | "travel";
export type TimeFilter = "all" | "Day" | "Night";
export type Order = "area" | "story" | "item";
export type Role = "owner" | "editor" | "viewer";

export interface PhotoLink { href: string; label: string }

export interface ItemRow {
  list_id: string;
  n: number;
  area: string;
  location: string;
  age: Age;
  night: boolean;
  notes: string;
  map_level: string | null;
  adult_first: boolean;
  item_group: string | null;
  photo_links: PhotoLink[];
}

export interface ChecklistList {
  id: string;
  name: string;
  noun: string;
  req_label: string;
  sub: string;
  foot: string;
  sort_order: number;
  item_groups: string[] | null;
  rows: ItemRow[];
  areaIdx: Record<string, number>;
  sortable: boolean;
}

export interface Source {
  id: number; site: string; site_url: string; title: string; url: string; used_for: string; list_ids: string[]; sort_order: number;
}
export interface SourceNote { id: number; list_id: string | null; note: string }

/** A per-save change to one row. Values are strings so they diff cleanly. */
export interface RowEdit { a?: string; l?: string; lv?: string; age?: string; time?: string; note?: string; af?: "1" | "0" }

/** Progress for one list: collected numbers and row edits. */
export interface ListState { got: Set<number>; O: Record<number, RowEdit> }
export type Progress = Record<string, ListState>;

/** A reference row with this save's edits applied. */
export interface EffRow {
  n: number; a: string; l: string; lv: string; age: Age; time: Time; note: string; af: boolean;
  group: string | null; links: PhotoLink[]; edited: boolean;
}

export interface SaveFile { id: string; name: string; owner_id: string; updated_at: string; role: Role; owner_email?: string }

export interface Settings { theme: string; mode: "light" | "dark"; density: "comfortable" | "compact" }
