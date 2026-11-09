import { createClient } from "@supabase/supabase-js";

// The publishable key is safe in the browser: every table is protected by row-level security.
const url = import.meta.env.VITE_SUPABASE_URL ?? "https://bvadurdndhaezlvwmlhb.supabase.co";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FhGbYePSbTTOJ6XKhiGLGw_3FqP1Meb";

/**
 * How this page was opened from an email link ("invite", "signup", "recovery", "magiclink"…), or null.
 * Read before the client starts, because the client clears the link's #… from the address bar.
 */
export const arrivedVia: string | null = (() => {
  try { return new URLSearchParams(location.hash.slice(1)).get("type"); } catch { return null; }
})();

export const sb = createClient(url, key);
