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
  /** Any, Day or Night (night is kept in step for older builds) */
  time_of_day?: "Any" | "Day" | "Night";
  notes: string;
  map_level: string | null;
  adult_first: boolean;
  item_group: string | null;
  photo_links: PhotoLink[];
  /** When an admin last changed this row (null: unchanged since launch) */
  updated_at?: string | null;
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
export interface ListState {
  got: Set<number>; O: Record<number, RowEdit>;
  /** When each row edit was last made or reviewed (ISO time), to spot shared rows updated since */
  T?: Record<number, string>;
}
export type Progress = Record<string, ListState>;

/** A reference row with this save's edits applied. */
export interface EffRow {
  n: number; a: string; l: string; lv: string; age: Age; time: Time; note: string; af: boolean;
  group: string | null; links: PhotoLink[]; edited: boolean;
  /** Edited here, and the shared row has changed since: worth a look */
  stale: boolean;
}

export interface SaveFile { id: string; name: string; owner_id: string; updated_at: string; role: Role; owner_email?: string; /** checkmarks in this save */ done?: number }

export interface Settings { theme: string; mode: "light" | "dark"; density: "comfortable" | "compact"; /** page zoom, 75–125 (%) */ zoom: number }
