import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import { completion, percent, totalItems } from "../lib/progress";
import type { ChecklistList, Progress, SaveFile } from "../lib/types";
import { useNotify, type Notify } from "./Notify";
import { ProgressSummary } from "./ProgressSummary";
import { ConfirmButton, Modal } from "./ui";
import { ANY_LIST, guessList, matchAnyList, matchRows, namesMatch, readSpreadsheet, type ParsedSheet } from "../lib/sheets";

type View = "signin" | "signup" | "forgot" | "main" | "share" | "errors" | "import";
const redirectTo = () => window.location.origin + window.location.pathname;

/** Edge functions return { error } with a non-2xx status; pull out that message. */
async function fnError(error: unknown): Promise<unknown> {
  try {
    const body = await (error as { context: Response }).context.json();
    if (body?.error) return { message: body.error };
  } catch { /* keep original */ }
  return error;
}

interface Props {
  open: boolean; onClose: () => void; user: User | null; recovering: boolean; onRecovered: () => void;
  welcoming: boolean; onWelcomed: () => void;
  lists: ChecklistList[]; curId: string; saves: SaveFile[]; active: SaveFile | null;
  progress: Progress; activeId: string | null;
  onSwitch: (id: string) => void; reloadSaves: () => Promise<SaveFile[] | null>;
  guestData: boolean; onCopyGuest: () => Promise<void>;
  onImport: (listId: string, ns: number[]) => Promise<boolean>;
}

export function AccountPanel(p: Props) {
  const notify = useNotify();
  const [view, setView] = useState<View>("signin");
  const [shareId, setShareId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { if (p.open) setView(p.user ? "main" : "signin"); }, [p.open, p.user]);
  useEffect(() => {
    if (!p.user) { setIsAdmin(false); return; }
    sb.rpc("am_i_admin").then(({ data, error }) => { if (!error) setIsAdmin(!!data); });
  }, [p.user]);

  let body, title = p.user ? "Account" : "Sign in";
  const back = () => setView("main");
  const shareSave = p.saves.find(s => s.id === shareId);
  const welcome = p.welcoming && !!p.user && !p.recovering;
  if (p.recovering && p.user) body = <Recover user={p.user} notify={notify} done={() => { p.onRecovered(); notify.ok("Password updated."); setView("main"); }} />;
  else if (welcome) { title = "Welcome"; body = <Welcome {...p} user={p.user!} notify={notify} done={p.onWelcomed} />; }
  else if (!p.user) body = <SignIn view={view} go={setView} notify={notify} />;
  else if (view === "share" && shareSave) { title = "Share"; body = <Share save={shareSave} back={back} notify={notify} reloadSaves={p.reloadSaves} />; }
  else if (view === "errors" && isAdmin) { title = "Error log"; body = <ErrorLog back={back} notify={notify} />; }
  else if (view === "import") { title = "Import"; body = <><p className="alinks top"><button className="linkbtn" onClick={back}>‹ Back</button></p><ImportBox lists={p.lists} curId={p.curId} active={p.active} onImport={p.onImport} notify={notify} /></>; }
  else body = <Main {...p} user={p.user} notify={notify} isAdmin={isAdmin} go={setView} onShare={id => { setShareId(id); setView("share"); }} />;

  return (
    <Modal open={p.open || p.recovering || welcome} onClose={welcome ? p.onWelcomed : p.onClose} title={title} labelId="acctTitle" className="acctpanel" center>
      {body}
    </Modal>
  );
}

/**
 * First visit from an invite email. They're signed in by the link. Shows whose playthrough this is and
 * how far along it is, then lets them pick a name and a password (or skip and use Google later).
 */
function Welcome(p: Props & { user: User; notify: Notify; done: () => void }) {
  const { user, saves, notify } = p;
  const meta = (user.user_metadata ?? {}) as { invited_by?: string; save_name?: string; save_id?: string; role?: string };
  const shared = saves.find(s => s.id === meta.save_id) ?? saves.find(s => s.role !== "owner");
  const [name, setName] = useState(""), [pw, setPw] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    sb.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => setName(data?.display_name ?? ""));
  }, [user.id]);
  // Open the shared playthrough right away so its progress loads behind this popup
  const switched = useRef(false);
  useEffect(() => { if (shared && !switched.current) { switched.current = true; p.onSwitch(shared.id); } }, [shared, p]);
  const ready = !!shared && p.activeId === shared.id;
  const c = completion(p.lists, p.progress);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (pw) {
        const { error } = await sb.auth.updateUser({ password: pw });
        if (error) return notify.error("welcome password", error, "Couldn't set your password");
      }
      const { error } = await sb.from("profiles").update({ display_name: name.trim().slice(0, 60) || null }).eq("id", user.id);
      if (error) return notify.error("welcome name", error, "Couldn't save your name");
      if (pw) notify.ok("Password saved. Next time, sign in with your email and this password.");
      p.done();
    } finally { setBusy(false); }
  };
  const what = shared?.name ?? meta.save_name ?? "a playthrough";
  const by = meta.invited_by ?? shared?.owner_email;
  const role = shared?.role ?? meta.role;
  return (
    <form className="aform welcome" onSubmit={submit}>
      <div className="whero">
        <span className="weyebrow">{by ? `${by} invited you to` : "You've joined"}</span>
        <b className="wsave">{what}</b>
        <span className="wrole">{role === "viewer" ? "View only" : "You can check things off together"}</span>
      </div>
      {ready ? <ProgressSummary c={c} /> : <p className="anote center">Loading progress…</p>}
      <div className="wform">
        <label>Your name<input className="sel" maxLength={60} placeholder="What others see" value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
        <label>Password <small>(optional)</small><input className="sel" type="password" minLength={8} placeholder="8+ characters, or use Google later" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></label>
      </div>
      <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Start playing"}</button>
    </form>
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

function SignIn({ view, go, notify }: { view: View; go: (v: View) => void; notify: Notify }) {
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [busy, setBusy] = useState(false);
  const signup = view === "signup", forgot = view === "forgot";
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (forgot) {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
        if (error) notify.error("reset password", error, "Couldn't send the reset email");
        else notify.ok("If that email has an account, a reset link is on its way.");
      } else if (signup) {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: redirectTo() } });
        if (error) notify.error("sign up", error, "Couldn't create the account");
        else if (!data.session) notify.ok("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) notify.error("sign in", error, "Couldn't sign in");
      }
    } catch (err) { notify.error("auth form", err, "Something went wrong"); }
    finally { setBusy(false); }
  };
  const google = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) notify.error("google sign in", error, "Couldn't start Google sign-in");
  };
  return <>
    <button className="gbtn" onClick={google}><GoogleIcon />Continue with Google</button>
    <div className="or"><span>or use email</span></div>
    <form className="aform" onSubmit={submit}>
      <label>Email<input className="sel" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      {!forgot && <label>Password<input className="sel" type="password" minLength={8} required autoComplete={signup ? "new-password" : "current-password"} value={pw} onChange={e => setPw(e.target.value)} /></label>}
      <button className="primary" type="submit" disabled={busy}>{busy ? "Please wait…" : forgot ? "Send reset link" : signup ? "Create account" : "Sign in"}</button>
    </form>
    <p className="alinks">
      {forgot ? <button className="linkbtn" onClick={() => go("signin")}>Back to sign in</button>
        : signup ? <>Have an account? <button className="linkbtn" onClick={() => go("signin")}>Sign in</button></>
        : <><button className="linkbtn" onClick={() => go("forgot")}>Forgot password?</button> · New here? <button className="linkbtn" onClick={() => go("signup")}>Create an account</button></>}
    </p>
    <p className="anote">Signing in keeps your progress on every device, gives you several save files, and lets you share them. Without an account, checkmarks stay in this browser.</p>
    <p className="anote">By signing in you agree to the <a href="/terms.html" target="_blank" rel="noopener">Terms</a> and <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>
  </>;
}

function Recover({ user, done, notify }: { user: User; done: () => void; notify: Notify }) {
  const [pw, setPw] = useState("");
  return (
    <form className="aform" onSubmit={async e => {
      e.preventDefault();
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) notify.error("update password", error, "Couldn't update the password"); else done();
    }}>
      <p>Choose a new password for <b>{user.email}</b>.</p>
      <label>New password<input className="sel" type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
      <button className="primary" type="submit">Save new password</button>
    </form>
  );
}

function Main(p: Props & { user: User; notify: Notify; isAdmin: boolean; go: (v: View) => void; onShare: (id: string) => void }) {
  const { saves, active, notify } = p;
  const [creating, setCreating] = useState(false), [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null), [renameTo, setRenameTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const own = saves.filter(s => s.role === "owner"), shared = saves.filter(s => s.role !== "owner");
  const total = totalItems(p.lists);

  const switchAfter = (left: SaveFile[] | null, removedId: string) => { if (left && active?.id === removedId && left[0]) p.onSwitch(left[0].id); };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const { data, error } = await sb.from("save_files").insert({ name: newName.trim() }).select().single();
    if (error) return notify.error("create save", error, "Couldn't create the save file");
    setNewName(""); setCreating(false); await p.reloadSaves(); p.onSwitch(data.id); notify.ok(`Created “${data.name}”.`);
  };
  const rename = async (id: string) => {
    const { error } = await sb.from("save_files").update({ name: renameTo.trim(), updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return notify.error("rename save", error, "Couldn't rename the save file");
    setRenaming(null); await p.reloadSaves(); notify.ok("Renamed.");
  };
  const remove = async (s: SaveFile) => {
    const { error } = await sb.from("save_files").delete().eq("id", s.id);
    if (error) return notify.error("delete save", error, "Couldn't delete the save file");
    switchAfter(await p.reloadSaves(), s.id); notify.ok(`Deleted “${s.name}”.`);
  };
  const leave = async (s: SaveFile) => {
    const { error } = await sb.from("save_members").delete().eq("save_id", s.id).eq("user_id", p.user.id);
    if (error) return notify.error("leave save", error, "Couldn't leave the save file");
    switchAfter(await p.reloadSaves(), s.id); notify.ok(`You left “${s.name}”.`);
  };
  /** Copy a save (yours or one shared with you) into a new save you own. */
  const duplicate = async (s: SaveFile) => {
    setBusy(s.id);
    try {
      const [prog, edits] = await Promise.all([
        sb.from("save_progress").select("list_id,n").eq("save_id", s.id),
        sb.from("save_edits").select("list_id,n,changes").eq("save_id", s.id),
      ]);
      if (prog.error || edits.error) return notify.error("copy save read", prog.error ?? edits.error, "Couldn't read that save file");
      const { data: n, error } = await sb.from("save_files").insert({ name: `${s.name} (copy)`.slice(0, 80) }).select().single();
      if (error) return notify.error("copy save create", error, "Couldn't create the copy");
      const jobs = [];
      if (prog.data.length) jobs.push(sb.from("save_progress").insert(prog.data.map(r => ({ ...r, save_id: n.id }))));
      if (edits.data.length) jobs.push(sb.from("save_edits").insert(edits.data.map(r => ({ ...r, save_id: n.id }))));
      const bad = (await Promise.all(jobs)).find(r => r.error);
      if (bad) { await sb.from("save_files").delete().eq("id", n.id); return notify.error("copy save write", bad.error, "Couldn't finish copying"); }
      await p.reloadSaves(); p.onSwitch(n.id); notify.ok(`Copied to “${n.name}”.`);
    } finally { setBusy(null); }
  };
  const signOut = async () => {
    const { error } = await sb.auth.signOut();
    if (error) return notify.error("sign out", error, "Couldn't sign out");
    p.onClose(); notify.ok("Signed out.");
  };

  const row = (s: SaveFile) => {
    // The active save shows live progress; others use the count loaded with the list
    const done = s.id === active?.id ? completion(p.lists, p.progress).done : s.done ?? 0;
    const pc = percent(done, total);
    const sub = s.role === "owner" ? "Yours" : `${s.owner_email?.split("@")[0] ?? "Shared"} · ${s.role === "editor" ? "can edit" : "view only"}`;
    return (
      <li key={s.id} className={"srow" + (active?.id === s.id ? " on" : "")}>
        {renaming === s.id ? (
          <form className="inline" onSubmit={e => { e.preventDefault(); rename(s.id); }}>
            <input className="sel" aria-label="New name" maxLength={80} required autoFocus value={renameTo} onChange={e => setRenameTo(e.target.value)} />
            <button className="primary sm" type="submit">Save</button>
            <button className="linkbtn" type="button" onClick={() => setRenaming(null)}>Cancel</button>
          </form>
        ) : <>
          <button className="spick" onClick={() => p.onSwitch(s.id)} aria-pressed={active?.id === s.id}>
            <span className="sline"><b>{s.name}</b><span className="spct">{pc}%</span></span>
            <span className="sbar"><i style={{ width: `${pc}%` }} /></span>
            <small>{sub}</small>
          </button>
          <RowMenu label={`Options for ${s.name}`}>
            {close => <>
              {s.role === "owner" && <button className="kitem" onClick={() => { close(); p.onShare(s.id); }}>Share…</button>}
              {s.role === "owner" && <button className="kitem" onClick={() => { close(); setRenaming(s.id); setRenameTo(s.name); }}>Rename</button>}
              <button className="kitem" disabled={busy === s.id} onClick={() => { close(); duplicate(s); }}>Make a copy</button>
              {s.role === "owner"
                ? own.length > 1 && <ConfirmButton className="kitem danger" label="Delete…" confirmLabel="Tap again to delete" onConfirm={() => { close(); remove(s); }} />
                : <ConfirmButton className="kitem danger" label="Leave" confirmLabel="Tap again to leave" onConfirm={() => { close(); leave(s); }} />}
            </>}
          </RowMenu>
        </>}
      </li>
    );
  };

  return <>
    <Profile user={p.user} notify={notify} />
    <div className="shead"><h3>Save files</h3>{!creating && <button className="linkbtn" onClick={() => setCreating(true)}>+ New</button>}</div>
    {creating && (
      <form className="inline" onSubmit={create}>
        <input className="sel" aria-label="New save file name" placeholder="Name" maxLength={80} required autoFocus value={newName} onChange={e => setNewName(e.target.value)} />
        <button className="primary sm" type="submit">Create</button>
        <button className="linkbtn" type="button" onClick={() => setCreating(false)}>Cancel</button>
      </form>
    )}
    <ul className="slist">{own.map(row)}</ul>
    {shared.length > 0 && <><h3>Shared with you</h3><ul className="slist">{shared.map(row)}</ul></>}
    {p.guestData && active?.role === "owner" && (
      <p className="importbox">Checkmarks from before you signed in are saved in this browser. <button className="linkbtn" onClick={p.onCopyGuest}>Add them to “{active.name}”</button></p>
    )}
    <div className="afoot">
      <button className="linkbtn" onClick={() => p.go("import")}>Import</button>
      {p.isAdmin && <button className="linkbtn" onClick={() => p.go("errors")}>Error log</button>}
      <button className="linkbtn" onClick={signOut}>Sign out</button>
    </div>
    <DeleteAccount notify={notify} onDeleted={p.onClose} />
  </>;
}

/** A small ⋮ dropdown for one row. */
function RowMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span className="rowmenu" ref={wrap}>
      <button className="kbtn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>⋮</button>
      {open && <div className="rmenu" role="menu">{children(() => setOpen(false))}</div>}
    </span>
  );
}

function Profile({ user, notify }: { user: User; notify: Notify }) {
  const [name, setName] = useState<string | null>(null), [draft, setDraft] = useState(""), [editing, setEditing] = useState(false);
  useEffect(() => {
    sb.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data, error }) => {
      if (error) notify.error("load profile", error, "Couldn't load your profile");
      else setName(data?.display_name ?? "");
    });
  }, [user.id, notify]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const v = draft.trim().slice(0, 60);
    const { error } = await sb.from("profiles").update({ display_name: v || null }).eq("id", user.id);
    if (error) return notify.error("update profile", error, "Couldn't save your name");
    setName(v); setEditing(false); notify.ok("Name saved.");
  };
  const shown = name || user.email || "";
  return (
    <div className="who">
      <span className="wav" aria-hidden="true">{shown[0]?.toUpperCase()}</span>
      {editing ? (
        <form className="inline" onSubmit={save}>
          <input className="sel" aria-label="Display name" placeholder="Name others see" maxLength={60} autoFocus value={draft} onChange={e => setDraft(e.target.value)} />
          <button className="primary sm" type="submit">Save</button>
          <button className="linkbtn" type="button" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : <>
        <span className="wname"><b>{shown}</b>{name && <small>{user.email}</small>}</span>
        <button className="iconbtn" aria-label="Edit your name" title="Edit your name" onClick={() => { setDraft(name ?? ""); setEditing(true); }}>✎</button>
      </>}
    </div>
  );
}

function DeleteAccount({ notify, onDeleted }: { notify: Notify; onDeleted: () => void }) {
  const [open, setOpen] = useState(false), [typed, setTyped] = useState(""), [busy, setBusy] = useState(false);
  const del = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await sb.functions.invoke("delete-account", { body: { confirm: "DELETE" } });
    if (error) { setBusy(false); return notify.error("delete account", await fnError(error), "Couldn't delete your account"); }
    await sb.auth.signOut({ scope: "local" });
    onDeleted(); notify.ok("Your account and save files were deleted.");
  };
  if (!open) return <p className="adanger"><button className="linkbtn" onClick={() => setOpen(true)}>Delete account</button></p>;
  return (
    <form className="dangerbox aform" onSubmit={del}>
      <p>Deletes your account and every save file you own, including for anyone you shared with. This can't be undone.</p>
      <label>Type DELETE to confirm<input className="sel" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" /></label>
      <span className="sacts">
        <button className="primary sm danger" type="submit" disabled={typed !== "DELETE" || busy}>{busy ? "Deleting…" : "Delete account"}</button>
        <button className="linkbtn" type="button" onClick={() => { setOpen(false); setTyped(""); }}>Cancel</button>
      </span>
    </form>
  );
}

interface Person { user_id: string; email: string; display_name: string | null; role: string }
interface Invite { id: string; email: string; role: string }

function Share({ save, back, notify, reloadSaves }: { save: SaveFile; back: () => void; notify: Notify; reloadSaves: () => Promise<SaveFile[] | null> }) {
  const [people, setPeople] = useState<Person[] | null>(null), [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState(""), [role, setRole] = useState("editor"), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [ppl, inv] = await Promise.all([
      sb.rpc("save_people", { p_save: save.id }),
      sb.from("save_invites").select("id,email,role").eq("save_id", save.id).is("accepted_at", null).order("created_at"),
    ]);
    if (ppl.error || inv.error) notify.error("load sharing", ppl.error ?? inv.error, "Couldn't load who has access");
    setPeople((ppl.data ?? []) as Person[]); setInvites((inv.data ?? []) as Invite[]);
  }, [save.id, notify]);
  useEffect(() => { load(); }, [load]);

  const send = async (to: string, r: string) => {
    const { data, error } = await sb.functions.invoke("share-save", { body: { save_id: save.id, email: to, role: r, redirect_to: redirectTo() } });
    if (error) { notify.error("share save", await fnError(error), "Couldn't share"); return false; }
    data.status === "pending" ? notify.info(data.message) : notify.ok(data.message);
    return true;
  };
  const invite = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    if (await send(email.trim(), role)) setEmail("");
    setBusy(false); load();
  };
  const changeRole = async (x: Person, r: string) => {
    const { error } = await sb.from("save_members").update({ role: r }).eq("save_id", save.id).eq("user_id", x.user_id);
    if (error) { notify.error("change role", error, "Couldn't change their access"); return load(); }
    notify.ok(`${x.display_name || x.email} can now ${r === "editor" ? "edit" : "only view"}.`);
  };
  const remove = async (x: Person) => {
    const { error } = await sb.from("save_members").delete().eq("save_id", save.id).eq("user_id", x.user_id);
    if (error) return notify.error("remove member", error, "Couldn't remove them");
    notify.ok(`Removed ${x.display_name || x.email}.`); load();
  };
  const transfer = async (x: Person) => {
    const { error } = await sb.rpc("transfer_save", { p_save: save.id, p_new_owner: x.user_id });
    if (error) return notify.error("transfer save", error, "Couldn't transfer the save file");
    await reloadSaves(); notify.ok(`${x.display_name || x.email} now owns “${save.name}”. You can still edit it.`); back();
  };
  const cancel = async (i: Invite) => {
    const { error } = await sb.from("save_invites").delete().eq("id", i.id);
    if (error) return notify.error("cancel invite", error, "Couldn't cancel the invite");
    notify.ok(`Canceled the invite to ${i.email}.`); load();
  };

  return <>
    <p className="alinks"><button className="linkbtn" onClick={back}>‹ Back</button></p>
    <h3>Share “{save.name}”</h3>
    <form className="aform" onSubmit={invite}>
      <label>Email<input className="sel" type="email" required placeholder="friend@example.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Access<select className="sel" value={role} onChange={e => setRole(e.target.value)}><option value="editor">Can edit</option><option value="viewer">View only</option></select></label>
      <button className="primary sm" type="submit" disabled={busy}>{busy ? "Sharing…" : "Share"}</button>
    </form>
    <h3>People with access</h3>
    <ul className="plist">
      {!people && <li className="anote">Loading…</li>}
      {people?.map(x => (
        <li key={x.user_id}>
          <span><b>{x.display_name || x.email}</b><small>{x.email}</small></span>
          {x.role === "owner" ? <span className="tagr">Owner</span> : (
            <span className="pacts">
              <select className="sel sm" aria-label={`Access for ${x.email}`} defaultValue={x.role} onChange={e => changeRole(x, e.target.value)}>
                <option value="editor">Can edit</option><option value="viewer">View only</option>
              </select>
              <ConfirmButton className="linkbtn" label="Make owner" confirmLabel="Tap again to hand over" onConfirm={() => transfer(x)} />
              <ConfirmButton label="Remove" confirmLabel="Tap again to remove" onConfirm={() => remove(x)} />
            </span>
          )}
        </li>
      ))}
    </ul>
    <h3>Pending invites</h3>
    <ul className="plist">
      {invites.length ? invites.map(i => (
        <li key={i.id}><span><b>{i.email}</b><small>{i.role === "editor" ? "Can edit" : "View only"} · waiting for them to sign up</small></span>
          <span className="pacts">
            <button className="linkbtn" onClick={async () => { await send(i.email, i.role); load(); }}>Resend</button>
            <button className="linkbtn danger" onClick={() => cancel(i)}>Cancel</button>
          </span></li>
      )) : <li className="anote">None.</li>}
    </ul>
  </>;
}

interface ErrRow { id: number; created_at: string; user_id: string | null; context: string; message: string; code: string | null; url: string | null; app_version: string | null; detail: unknown }

function ErrorLog({ back, notify }: { back: () => void; notify: Notify }) {
  const [rows, setRows] = useState<ErrRow[] | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await sb.from("client_errors").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) return notify.error("load error log", error, "Couldn't load the error log");
    setRows(data as ErrRow[]);
  }, [notify]);
  useEffect(() => { load(); }, [load]);
  const clear = async () => {
    const { error } = await sb.from("client_errors").delete().gte("id", 0);
    if (error) return notify.error("clear error log", error, "Couldn't clear the log");
    notify.ok("Error log cleared."); load();
  };
  return <>
    <p className="alinks"><button className="linkbtn" onClick={back}>‹ Back</button> · <button className="linkbtn" onClick={load}>Refresh</button>
      {rows && rows.length > 0 && <> · <ConfirmButton label="Clear all" confirmLabel="Tap again to clear" onConfirm={clear} /></>}</p>
    <h3>Recent errors</h3>
    <p className="anote">Errors from everyone's browsers, newest first. Expected ones (wrong password, offline) aren't logged.</p>
    <ul className="errlist">
      {!rows && <li className="anote">Loading…</li>}
      {rows?.length === 0 && <li className="anote">No errors logged.</li>}
      {rows?.map(r => (
        <li key={r.id}>
          <details>
            <summary><b>{r.context}</b> <span>{r.message}</span><small>{new Date(r.created_at).toLocaleString()}{r.code ? ` · ${r.code}` : ""}{r.user_id ? ` · user ${r.user_id.slice(0, 8)}` : " · signed out"}</small></summary>
            <pre>{JSON.stringify({ url: r.url, version: r.app_version, user: r.user_id, detail: r.detail }, null, 2)}</pre>
          </details>
        </li>
      ))}
    </ul>
  </>;
}

/** Import checkmarks from a .xlsx (every tab) or .csv. Only adds checkmarks; never removes any. */
function ImportBox({ lists, curId, active, onImport, notify }: {
  lists: ChecklistList[]; curId: string; active: SaveFile | null; notify: Notify;
  onImport: (listId: string, ns: number[]) => Promise<boolean>;
}) {
  const [sheets, setSheets] = useState<ParsedSheet[] | null>(null);
  const [map, setMap] = useState<(string | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const canWrite = !!active && active.role !== "viewer";

  const pick = async (file: File | undefined) => {
    setSheets(null); if (!file) return;
    try {
      const parsed = await readSpreadsheet(file);
      setSheets(parsed);
      // A single CSV/tab with no recognizable name goes to the list you're looking at
      setMap(parsed.map((s, i) => s.error ? null : guessList(s, lists, i) ?? (parsed.length === 1 ? curId : null)));
    } catch (e) { notify.error("read spreadsheet", e, "Couldn't read that file"); }
  };
  // For each tab: which item numbers it will check, per list
  const plan = (sheets ?? []).map((s, i) => {
    if (map[i] === ANY_LIST) { const m = matchAnyList(s, lists); return { byList: m.byList, unmatched: m.unmatched }; }
    const L = lists.find(x => x.id === map[i]);
    if (!L) return null;
    const m = matchRows(s, L, namesMatch(s, L, i) || (sheets!.length === 1));
    return { byList: new Map([[L.id, m.ns]]), unmatched: m.unmatched };
  });
  const count = (p: (typeof plan)[number]) => p ? [...p.byList.values()].reduce((t, ns) => t + ns.length, 0) : 0;
  const total = plan.reduce((t, p) => t + count(p), 0);
  const describe = (p: NonNullable<(typeof plan)[number]>) => [...p.byList].map(([id, ns]) => `${ns.length} in ${lists.find(L => L.id === id)?.name}`).join(", ");

  const run = async () => {
    setBusy(true);
    const byList = new Map<string, Set<number>>();
    plan.forEach(p => p?.byList.forEach((ns, id) => ns.forEach(n => (byList.get(id) ?? byList.set(id, new Set()).get(id)!).add(n))));
    let done = 0;
    for (const [id, ns] of byList) if (ns.size && await onImport(id, [...ns])) done += ns.size;
    setBusy(false);
    if (done) { notify.ok(`Imported ${done} checkmarks into “${active?.name}”.`); setSheets(null); }
  };

  return (
    <div className="aform">
      <p className="anote">Add checkmarks from an Excel (.xlsx) or CSV file, like your old Google Sheet. Tabs are matched to lists automatically. Nothing gets unchecked.</p>
      <label>File<input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => pick(e.target.files?.[0])} /></label>
      {sheets && <>
        <ul className="implist">
          {sheets.map((s, i) => (
            <li key={i}>
              <span><b>{s.name}</b><small>{s.error ?? `${s.collected.length} collected of ${s.rows} rows`}</small></span>
              {!s.error && <select className="sel sm" aria-label={`List for ${s.name}`} value={map[i] ?? ""} onChange={e => setMap(m => m.map((v, j) => j === i ? e.target.value || null : v))}>
                <option value="">Skip this tab</option>
                <option value={ANY_LIST}>Mixed: match each row to any list</option>
                {lists.map(L => <option key={L.id} value={L.id}>{L.name}</option>)}
              </select>}
              {plan[i] && <small className="impres">{count(plan[i]) ? `Will check ${describe(plan[i]!)}` : "Nothing to check"}{plan[i]!.unmatched ? ` · ${plan[i]!.unmatched} didn't match` : ""}</small>}
            </li>
          ))}
        </ul>
        <button className="primary sm" disabled={!canWrite || !total || busy} onClick={run}>
          {busy ? "Importing…" : canWrite ? `Import ${total} checkmarks into “${active?.name ?? ""}”` : "This save file is view only"}
        </button>
      </>}
    </div>
  );
}
