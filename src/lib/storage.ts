/** localStorage that never throws (private windows, blocked storage). */
export const ls = {
  get<T>(k: string, d: T): T {
    try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; }
  },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const guestKey = (listId: string, k: "got" | "edits") => `oot-guest-${listId}-${k}`;
