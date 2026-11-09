import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import type { ChecklistList, SaveFile } from "../lib/types";
import { ConfirmButton, Modal } from "./ui";

type View = "signin" | "signup" | "forgot" | "main" | "share";
type Msg = { text: string; ok?: boolean } | null;
const redirectTo = () => window.location.origin + window.location.pathname;

export function AccountPanel(p: {
  open: boolean; onClose: () => void; user: User | null; recovering: boolean; onRecovered: () => void;
  lists: ChecklistList[]; curId: string; saves: SaveFile[]; active: SaveFile | null;
  onSwitch: (id: string) => void; reloadSaves: () => Promise<SaveFile[]>;
  guestData: boolean; onCopyGuest: () => Promise<string>;
  onImport: (listId: string, ns: number[]) => Promise<string | null>;
  toast: (text: string, err?: boolean) => void;
}) {
  const [view, setView] = useState<View>("signin");
  const [shareId, setShareId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  useEffect(() => { if (p.open) { setView(p.user ? "main" : "signin"); setMsg(null); } }, [p.open, p.user]);
  const go = (v: View) => { setView(v); setMsg(null); };

  let body;
  if (p.recovering && p.user) body = <Recover user={p.user} done={() => { p.onRecovered(); p.toast("Password updated."); go("main"); }} setMsg={setMsg} />;
  else if (!p.user) body = <SignIn view={view} go={go} setMsg={setMsg} />;
  else if (view === "share" && shareId) body = <Share save={p.saves.find(s => s.id === shareId)!} back={() => go("main")} setMsg={setMsg} />;
  else body = <SaveFiles {...p} user={p.user} setMsg={setMsg} onShare={id => { setShareId(id); go("share"); }} />;

  return (
    <Modal open={p.open || p.recovering} onClose={p.onClose} title={p.user ? "Account" : "Sign in"} labelId="acctTitle" className="acctpanel" center>
      {body}
      {msg && <p className={"aerr" + (msg.ok ? " ok" : "")}>{msg.text}</p>}
    </Modal>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function SignIn({ view, go, setMsg }: { view: View; go: (v: View) => void; setMsg: (m: Msg) => void }) {
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [busy, setBusy] = useState(false);
  const signup = view === "signup", forgot = view === "forgot";
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (forgot) {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
        setMsg(error ? { text: error.message } : { text: "If that email has an account, a reset link is on its way.", ok: true });
      } else if (signup) {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: redirectTo() } });
        if (error) setMsg({ text: error.message }); else if (!data.session) setMsg({ text: "Check your email to confirm your account, then sign in.", ok: true });
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) setMsg({ text: error.message });
      }
    } finally { setBusy(false); }
  };
  return <>
    <button className="gbtn" onClick={() => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } })}><GoogleIcon />Continue with Google</button>
    <div className="or"><span>or use email</span></div>
    <form className="aform" onSubmit={submit}>
      <label>Email<input className="sel" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      {!forgot && <label>Password<input className="sel" type="password" minLength={8} required autoComplete={signup ? "new-password" : "current-password"} value={pw} onChange={e => setPw(e.target.value)} /></label>}
      <button className="primary" type="submit" disabled={busy}>{forgot ? "Send reset link" : signup ? "Create account" : "Sign in"}</button>
    </form>
    <p className="alinks">
      {forgot ? <button className="linkbtn" onClick={() => go("signin")}>Back to sign in</button>
        : signup ? <>Have an account? <button className="linkbtn" onClick={() => go("signin")}>Sign in</button></>
        : <><button className="linkbtn" onClick={() => go("forgot")}>Forgot password?</button> · New here? <button className="linkbtn" onClick={() => go("signup")}>Create an account</button></>}
    </p>
    <p className="anote">Signing in keeps your progress on every device, gives you several save files, and lets you share them. Without an account, checkmarks stay in this browser.</p>
  </>;
}

function Recover({ user, done, setMsg }: { user: User; done: () => void; setMsg: (m: Msg) => void }) {
  const [pw, setPw] = useState("");
  return (
    <form className="aform" onSubmit={async e => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: pw }); error ? setMsg({ text: error.message }) : done(); }}>
      <p>Choose a new password for <b>{user.email}</b>.</p>
      <label>New password<input className="sel" type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
      <button className="primary" type="submit">Save new password</button>
    </form>
  );
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

function SaveFiles(p: Parameters<typeof AccountPanel>[0] & { user: User; setMsg: (m: Msg) => void; onShare: (id: string) => void }) {
  const { saves, active, setMsg } = p;
  const [newName, setNewName] = useState(""), [renaming, setRenaming] = useState<string | null>(null), [renameTo, setRenameTo] = useState("");
  const [csvList, setCsvList] = useState(p.curId), [file, setFile] = useState<File | null>(null);
  const own = saves.filter(s => s.role === "owner"), shared = saves.filter(s => s.role !== "owner");

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const { data, error } = await sb.from("save_files").insert({ name: newName.trim() }).select().single();
    if (error) return setMsg({ text: error.message });
    setNewName(""); await p.reloadSaves(); p.onSwitch(data.id);
  };
  const rename = async (id: string) => {
    const { error } = await sb.from("save_files").update({ name: renameTo.trim(), updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return setMsg({ text: error.message });
    setRenaming(null); await p.reloadSaves();
  };
  const remove = async (id: string) => {
    const { error } = await sb.from("save_files").delete().eq("id", id);
    if (error) return setMsg({ text: error.message });
    const left = await p.reloadSaves(); if (active?.id === id && left[0]) p.onSwitch(left[0].id); p.toast("Save file deleted.");
  };
  const leave = async (id: string) => {
    const { error } = await sb.from("save_members").delete().eq("save_id", id).eq("user_id", p.user.id);
    if (error) return setMsg({ text: error.message });
    const left = await p.reloadSaves(); if (active?.id === id && left[0]) p.onSwitch(left[0].id); p.toast("You left that save file.");
  };
  const importCsv = async (e: FormEvent) => {
    e.preventDefault(); if (!file) return;
    const L = p.lists.find(x => x.id === csvList); if (!L) return;
    const rows = parseCsv(await file.text()); const head = (rows.shift() ?? []).map(h => h.trim().toLowerCase());
    const iN = head.indexOf("#"), iC = head.indexOf("collected");
    if (iN < 0 || iC < 0) return setMsg({ text: "That file needs a # column and a Collected column." });
    const valid = new Set(L.rows.map(r => r.n));
    const on = rows.filter(r => /^true$/i.test((r[iC] ?? "").trim())).map(r => +r[iN]).filter(n => valid.has(n));
    if (!on.length) return setMsg({ text: "No collected rows found in that file." });
    const err = await p.onImport(L.id, on);
    setMsg(err ? { text: err } : { text: `Imported ${on.length} checkmarks into ${L.name}.`, ok: true });
  };

  const row = (s: SaveFile) => (
    <li key={s.id} className={"srow" + (active?.id === s.id ? " on" : "")}>
      <button className="spick" onClick={() => p.onSwitch(s.id)}>
        <b>{s.name}</b>
        <small>{s.role === "owner" ? "Yours" : `${s.role === "editor" ? "Can edit" : "View only"} · ${s.owner_email ?? "shared"}`}</small>
      </button>
      <span className="sacts">
        {s.role === "owner" ? <>
          <button className="linkbtn" onClick={() => p.onShare(s.id)}>Share</button>
          <button className="linkbtn" onClick={() => { setRenaming(s.id); setRenameTo(s.name); }}>Rename</button>
          <ConfirmButton label="Delete" confirmLabel="Tap again to delete for good" onConfirm={() => remove(s.id)} />
        </> : <ConfirmButton label="Leave" confirmLabel="Tap again to leave" onConfirm={() => leave(s.id)} />}
      </span>
      {renaming === s.id && (
        <form className="inline" onSubmit={e => { e.preventDefault(); rename(s.id); }}>
          <input className="sel" maxLength={80} required autoFocus value={renameTo} onChange={e => setRenameTo(e.target.value)} />
          <button className="primary sm" type="submit">Save</button>
        </form>
      )}
    </li>
  );

  return <>
    <p className="who">Signed in as <b>{p.user.email}</b></p>
    <h3>Your save files</h3>
    <ul className="slist">{own.length ? own.map(row) : <li className="anote">No save files yet.</li>}</ul>
    <form className="inline" onSubmit={create}>
      <input className="sel" placeholder="New save file name" maxLength={80} required value={newName} onChange={e => setNewName(e.target.value)} />
      <button className="primary sm" type="submit">Create</button>
    </form>
    {shared.length > 0 && <><h3>Shared with you</h3><ul className="slist">{shared.map(row)}</ul></>}
    {p.guestData && active?.role === "owner" && (
      <div className="importbox">
        <p>This browser has checkmarks from before you signed in.</p>
        <button className="linkbtn" onClick={async () => setMsg({ text: await p.onCopyGuest(), ok: true })}>Copy them into “{active.name}”</button>
      </div>
    )}
    <h3>Import</h3>
    <form className="aform" onSubmit={importCsv}>
      <p className="anote">Bring in a CSV from the old Google Sheet or this site's download. It needs a <b>#</b> column and a <b>Collected</b> column (TRUE/FALSE).</p>
      <label>List<select className="sel" value={csvList} onChange={e => setCsvList(e.target.value)}>{p.lists.map(L => <option key={L.id} value={L.id}>{L.name}</option>)}</select></label>
      <label>CSV file<input type="file" accept=".csv,text/csv" required onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <button className="primary sm" type="submit" disabled={!active || active.role === "viewer"}>Import into “{active?.name ?? ""}”</button>
    </form>
    <p className="alinks"><button className="linkbtn" onClick={async () => { await sb.auth.signOut(); p.onClose(); }}>Sign out</button></p>
  </>;
}

interface Person { user_id: string; email: string; display_name: string | null; role: string }
interface Invite { id: string; email: string; role: string }

function Share({ save, back, setMsg }: { save: SaveFile; back: () => void; setMsg: (m: Msg) => void }) {
  const [people, setPeople] = useState<Person[] | null>(null), [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState(""), [role, setRole] = useState("editor"), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [{ data: ppl }, { data: inv }] = await Promise.all([
      sb.rpc("save_people", { p_save: save.id }),
      sb.from("save_invites").select("id,email,role").eq("save_id", save.id).is("accepted_at", null),
    ]);
    setPeople((ppl ?? []) as Person[]); setInvites((inv ?? []) as Invite[]);
  }, [save.id]);
  useEffect(() => { load(); }, [load]);

  const invite = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { data, error } = await sb.functions.invoke("share-save", { body: { save_id: save.id, email: email.trim(), role, redirect_to: redirectTo() } });
    setBusy(false);
    if (error) {
      let text = error.message;
      try { text = (await (error as { context: Response }).context.json()).error || text; } catch { /* keep message */ }
      return setMsg({ text });
    }
    setMsg({ text: data.message, ok: true }); setEmail(""); load();
  };
  const changeRole = async (uid: string, r: string) => {
    const { error } = await sb.from("save_members").update({ role: r }).eq("save_id", save.id).eq("user_id", uid);
    setMsg(error ? { text: error.message } : { text: "Access updated.", ok: true });
  };
  const remove = async (uid: string) => {
    const { error } = await sb.from("save_members").delete().eq("save_id", save.id).eq("user_id", uid);
    if (error) return setMsg({ text: error.message });
    setMsg({ text: "Access removed.", ok: true }); load();
  };
  const cancel = async (id: string) => { const { error } = await sb.from("save_invites").delete().eq("id", id); error ? setMsg({ text: error.message }) : load(); };

  return <>
    <p className="alinks"><button className="linkbtn" onClick={back}>‹ Back to save files</button></p>
    <h3>Share “{save.name}”</h3>
    <form className="aform" onSubmit={invite}>
      <label>Email<input className="sel" type="email" required placeholder="friend@example.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Access<select className="sel" value={role} onChange={e => setRole(e.target.value)}><option value="editor">Can edit</option><option value="viewer">View only</option></select></label>
      <button className="primary sm" type="submit" disabled={busy}>Share</button>
    </form>
    <h3>People with access</h3>
    <ul className="plist">
      {!people && <li className="anote">Loading…</li>}
      {people?.map(x => (
        <li key={x.user_id}>
          <span><b>{x.display_name || x.email}</b><small>{x.email}</small></span>
          {x.role === "owner" ? <span className="tagr">Owner</span> : (
            <span className="pacts">
              <select className="sel sm" aria-label={`Access for ${x.email}`} defaultValue={x.role} onChange={e => changeRole(x.user_id, e.target.value)}>
                <option value="editor">Can edit</option><option value="viewer">View only</option>
              </select>
              <ConfirmButton label="Remove" confirmLabel="Tap again to remove" onConfirm={() => remove(x.user_id)} />
            </span>
          )}
        </li>
      ))}
    </ul>
    <h3>Pending invites</h3>
    <ul className="plist">
      {invites.length ? invites.map(i => (
        <li key={i.id}><span><b>{i.email}</b><small>{i.role === "editor" ? "Can edit" : "View only"} · waiting for them to sign up</small></span>
          <button className="linkbtn danger" onClick={() => cancel(i.id)}>Cancel</button></li>
      )) : <li className="anote">None.</li>}
    </ul>
  </>;
}
