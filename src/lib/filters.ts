import { useCallback, useEffect, useState } from "react";
import { ls } from "./storage";
import type { AgeFilter, ChecklistList, Order, TimeFilter } from "./types";

/**
 * Checklist filters, remembered in this browser so they carry across lists, reloads and tabs.
 * Age, time of day and "hide collected" apply to every list; the sort is kept per list, since
 * not every list can sort the same ways. Search stays per visit and clears when you switch lists.
 */
export type FilterPrefs = { age: AgeFilter; time: TimeFilter; area: string; hideDone: boolean; showGuides: boolean; order: Record<string, Order> };

const KEY = "oot-filters-v1";
const AGES: AgeFilter[] = ["all", "Child", "Adult", "travel"];
const TIMES: TimeFilter[] = ["all", "Day", "Night"];
const ORDERS: Order[] = ["area", "story", "item"];
const DEFAULTS: FilterPrefs = { age: "all", time: "all", area: "", hideDone: false, showGuides: true, order: {} };

/** Anything stored by an older build, another tab or a hand edit is checked before it is used. */
function read(): FilterPrefs {
  const v = ls.get<Partial<FilterPrefs> | null>(KEY, null);
  if (!v || typeof v !== "object") return DEFAULTS;
  const order: Record<string, Order> = {};
  if (v.order && typeof v.order === "object")
    for (const [k, o] of Object.entries(v.order)) if (ORDERS.includes(o as Order)) order[k] = o as Order;
  return {
    age: AGES.includes(v.age as AgeFilter) ? (v.age as AgeFilter) : "all",
    time: TIMES.includes(v.time as TimeFilter) ? (v.time as TimeFilter) : "all",
    area: typeof v.area === "string" ? v.area.slice(0, 80) : "",
    hideDone: v.hideDone === true,
    showGuides: v.showGuides !== false,
    order,
  };
}

export function useFilterPrefs() {
  const [prefs, setPrefs] = useState<FilterPrefs>(read);
  // Written on every change; small enough that this costs nothing
  useEffect(() => { ls.set(KEY, prefs); }, [prefs]);
  // Another tab changed them: follow along
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setPrefs(read()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const update = useCallback((p: Partial<Omit<FilterPrefs, "order">>) => setPrefs(s => ({ ...s, ...p })), []);
  const setOrder = useCallback((listId: string, o: Order) => setPrefs(s => ({ ...s, order: { ...s.order, [listId]: o } })), []);
  return { prefs, update, setOrder };
}

/** The saved sort for a list, or that list's natural default when nothing valid is saved. */
export function orderFor(list: ChecklistList, saved?: Order): Order {
  const ok = (o?: Order) => !!o && (o === "item" ? !!list.item_groups : o === "story" ? list.sortable : !list.item_groups || list.id === "all");
  if (ok(saved)) return saved!;
  return list.item_groups ? "item" : "area";
}

/** Tracks a CSS media query (e.g. phone width) and re-renders when it flips. */
export function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const f = () => setOn(m.matches);
    f(); m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [query]);
  return on;
}
