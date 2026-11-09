// Share a save file by email.
// The caller must own the save.
//  - Someone with an account is added right away and, if SMTP secrets are set, gets a "shared with you" email.
//  - Someone new gets the Supabase "Invite user" email and joins the save when they accept it.
// Re-sharing to the same email updates their role (and re-sends the email).
//
// Optional secrets for the "shared with you" email (Edge Functions -> Secrets):
//   SMTP_USER, SMTP_PASS (required to send), SMTP_HOST (default smtp.gmail.com), SMTP_PORT (default 465),
//   SMTP_FROM_NAME (default "Ocarina Completionist"), SITE_URL (default https://ocarina-completionist.vercel.app)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { SHARE_EMAIL_HTML } from "./email.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Send the "shared with you" email. Returns "sent", "not_configured", or an error message. */
async function sendShareEmail(to: string, inviter: string, saveName: string, role: string): Promise<string> {
  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return "not_configured";
  const site = Deno.env.get("SITE_URL") ?? "https://ocarina-completionist.vercel.app";
  const roleLine = role === "viewer"
    ? "You can <b>follow along</b> with their progress."
    : "You can <b>check things off together</b>. Changes show up for both of you right away.";
  const html = SHARE_EMAIL_HTML
    .replaceAll("%%INVITER%%", esc(inviter)).replaceAll("%%SAVE%%", esc(saveName))
    .replaceAll("%%ROLE_LINE%%", roleLine).replaceAll("%%URL%%", esc(site + "/"))
    .replaceAll("%%SITE%%", esc(site)).replaceAll("%%EMAIL%%", esc(to));
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
      port: Number(Deno.env.get("SMTP_PORT") ?? 465),
      tls: true,
      auth: { username: user, password: pass },
    },
  });
  try {
    await client.send({
      from: `${Deno.env.get("SMTP_FROM_NAME") ?? "Ocarina Completionist"} <${user}>`,
      to,
      subject: `${inviter} shared a playthrough with you`,
      content: `${inviter} shared "${saveName}" with you on Ocarina Completionist. Open ${site}/ and find it under Account > Shared with you.`,
      html,
    });
    return "sent";
  } catch (e) {
    console.error("share-save smtp", to, (e as Error).message);
    return (e as Error).message;
  } finally {
    try { await client.close(); } catch { /* already closed */ }
  }
}

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
  const inviterName = inviter?.display_name || inviter?.email || me.user.email || "Someone";
  const saveName = save?.name ?? "a playthrough";
  const can = role === "editor" ? "edit" : "view";

  if (existing) {
    const { error: memErr } = await admin.from("save_members")
      .upsert({ save_id: saveId, user_id: existing.id, role, added_by: me.user.id }, { onConflict: "save_id,user_id" });
    if (memErr) {
      console.error("share-save member", saveId, memErr.message);
      return json({ error: "Couldn't add them to the save file. Try again." }, 500);
    }
    await admin.from("save_invites").update({ accepted_at: new Date().toISOString() }).eq("save_id", saveId).eq("email", email);
    const mail = await sendShareEmail(email, inviterName, saveName, role);
    const note = mail === "sent" ? " We emailed them to let them know."
      : mail === "not_configured" ? " It's under “Shared with you” in their Account panel."
      : " It's under “Shared with you” in their Account panel (the heads-up email didn't send).";
    return json({ status: "added", email: mail, message: `${email} can now ${can} this save file.${note}` });
  }

  // Details for the invite email and the welcome screen (stored on the new user's metadata).
  const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: body.redirect_to || undefined,
    data: { invited_by: inviterName, save_name: saveName, save_id: saveId, role },
  });
  if (mailErr) {
    console.error("share-save email", email, mailErr.message);
    return json({ status: "pending", message: `Saved the invite, but the email didn't send (${mailErr.message}). ${email} will get access when they sign up with this email.` });
  }
  return json({ status: "invited", message: `Invite email sent to ${email}. They'll have access as soon as they accept it.` });
});
