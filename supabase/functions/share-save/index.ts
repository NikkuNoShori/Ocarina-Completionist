// Share a save file by email.
// The caller must own the save.
//  - Someone with an account is added right away. A database trigger gives them an in-app notice.
//  - Someone new (or invited but not yet accepted) gets the Supabase "Invite user" email and joins the save
//    the first time they sign in.
// Re-sharing to the same email updates their role (and re-sends the invite email if they haven't joined yet).
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

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  let body: { save_id?: string; email?: string; role?: string; redirect_to?: string };
  try { body = await req.json(); } catch { return json({ error: "Send JSON" }, 400); }
  const saveId = String(body.save_id ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = body.role === "viewer" ? "viewer" : "editor";
  if (!saveId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);

  // Act as the caller: row-level security only lets the owner create an invite.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: me } = await asUser.auth.getUser();
  if (!me?.user) return json({ error: "Sign in first." }, 401);
  if ((me.user.email ?? "").toLowerCase() === email) return json({ error: "That's your own email." }, 400);

  const { error: invErr } = await asUser.from("save_invites")
    .upsert({ save_id: saveId, email, role, invited_by: me.user.id, accepted_at: null }, { onConflict: "save_id,email" });
  if (invErr) {
    console.error("share-save invite", saveId, invErr.code, invErr.message);
    return json({ error: "Only the owner of this save file can share it." }, 403);
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const [{ data: existing, error: lookErr }, { data: inviter }, { data: save }] = await Promise.all([
    admin.from("profiles").select("id").ilike("email", email).maybeSingle(),
    admin.from("profiles").select("display_name,email").eq("id", me.user.id).maybeSingle(),
    admin.from("save_files").select("name").eq("id", saveId).maybeSingle(),
  ]);
  if (lookErr) {
    console.error("share-save lookup", lookErr.message);
    return json({ error: "Couldn't look up that email. Try again." }, 500);
  }
  const can = role === "editor" ? "edit" : "view";

  // Supabase creates the account as soon as an invite is sent, so a profile can exist for someone
  // who never accepted. Only treat them as an existing user once they've confirmed their email;
  // otherwise send (or re-send) the invite email below.
  let confirmed = false;
  if (existing) {
    const { data: u, error: uErr } = await admin.auth.admin.getUserById(existing.id);
    if (uErr) console.error("share-save getUser", uErr.message);
    confirmed = !!u?.user?.email_confirmed_at;
  }

  if (existing && confirmed) {
    const { error: memErr } = await admin.from("save_members")
      .upsert({ save_id: saveId, user_id: existing.id, role, added_by: me.user.id }, { onConflict: "save_id,user_id" });
    if (memErr) {
      console.error("share-save member", saveId, memErr.message);
      return json({ error: "Couldn't add them to the save file. Try again." }, 500);
    }
    await admin.from("save_invites").update({ accepted_at: new Date().toISOString() }).eq("save_id", saveId).eq("email", email);
    return json({ status: "added", message: `${email} can now ${can} this save file. They'll see a notice next time they open the site.` });
  }

  // Details for the invite email and the welcome screen (stored on the new user's metadata).
  const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: body.redirect_to || undefined,
    data: {
      invited_by: inviter?.display_name || inviter?.email || me.user.email,
      save_name: save?.name ?? "a playthrough",
      save_id: saveId,
      role,
    },
  });
  if (mailErr) {
    console.error("share-save email", email, mailErr.message);
    return json({ status: "pending", message: `Saved the invite, but the email didn't send (${mailErr.message}). ${email} will get access when they sign up with this email.` });
  }
  return json({ status: "invited", message: `Invite email sent to ${email}. They'll have access as soon as they accept it.` });
});
