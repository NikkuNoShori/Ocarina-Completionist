import { createClient } from "@supabase/supabase-js";

// The publishable key is safe in the browser: every table is protected by row-level security.
const url = import.meta.env.VITE_SUPABASE_URL ?? "https://bvadurdndhaezlvwmlhb.supabase.co";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FhGbYePSbTTOJ6XKhiGLGw_3FqP1Meb";

export const sb = createClient(url, key);
