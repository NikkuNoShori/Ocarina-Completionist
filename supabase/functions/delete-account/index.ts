// Permanently delete the signed-in user's account.
// Their profile, settings, roles and the save files they own are removed by ON DELETE CASCADE;
// they're removed from save files others shared with them.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  if (body.confirm !== "DELETE") return json({ error: "Confirmation missing." }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: me, error: meErr } = await asUser.auth.getUser();
  if (meErr || !me?.user) return json({ error: "Sign in first." }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(me.user.id);
  if (error) {
    console.error("delete-account failed", me.user.id, error.message);
    return json({ error: "Couldn't delete the account. Try again, or email nickneal17@gmail.com." }, 500);
  }
  console.log("deleted account", me.user.id);
  return json({ status: "deleted" });
});
