import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useReference } from "./hooks/useReference";
import { hasGuestData, useSaves } from "./hooks/useSaves";
import { useNotifications } from "./hooks/useNotifications";
import { useSettings } from "./hooks/useSettings";
import { friendly } from "./lib/errors";
import { completion } from "./lib/progress";
import { ageOK, applyEdit, cloneState, countGot, eff, emptyState, timeOK } from "./lib/rows";
import { downloadCsv, downloadXlsx } from "./lib/sheets";
import { ls } from "./lib/storage";
import type { AgeFilter, ListState, Order, RowEdit, TimeFilter } from "./lib/types";
import { AccountPanel } from "./components/AccountPanel";
import { ChecklistTable } from "./components/ChecklistTable";
import { FilterBar } from "./components/FilterBar";
import { LEGAL_TITLES, LegalPage, type LegalId } from "./components/LegalPage";
import { ListsDrawer } from "./components/ListsDrawer";
import { Avatar, nameOf } from "./components/Avatar";
import { useNotify } from "./components/Notify";
import { SourcesPanel } from "./components/SourcesPanel";
import { ProgressSummary } from "./components/ProgressSummary";
import { Modal, PanelIcon } from "./components/ui";

const wide = () => window.innerWidth >= 900;

export default function App() {
  const notify = useNotify();
  const { data: ref, error: refError, retry } = useReference();
  const { user, recovering, setRecovering, welcoming, setWelcoming } = useAuth(notify);
  const saves = useSaves(user, ref?.lists ?? null, notify);
  const [settings, setSettings] = useSettings(user, saves.activeId);
  // "Alex shared … with you" notices; Open switches to that save file (reloading the list first in case it's new)
  const [joinedId, setJoinedId] = useState<string | null>(null);
  useNotifications(user, notify, async id => { await saves.loadSaves(); saves.setActiveId(id); setJoinedId(id); if (legal) location.hash = ""; }, welcoming);

  const [curId, setCurId] = useState(() => window.location.hash.slice(1));
  const [filt, setFilt] = useState<AgeFilter>("all");
  const [tfilt, setTfilt] = useState<TimeFilter>("all");
  const [order, setOrder] = useState<Order>("area");
  const [search, setSearch] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [draft, setDraft] = useState<{ before: ListState; after: ListState } | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => (wide() ? ls.get("oot-panel-open", true) : false));
  const [srcOpen, setSrcOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const lists = ref?.lists ?? [];
  // #privacy and #terms are pages too; anything else is a checklist id
  const legal: LegalId | null = curId === "privacy" || curId === "terms" ? curId : null;
  const list = legal ? undefined : lists.find(L => L.id === curId) ?? lists[0];
  const firstId = list?.id ?? lists[0]?.id ?? "";
  const editing = !!draft;

  // Hash routing between lists (locked while editing)
  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (draft) { if (list && id !== list.id) window.location.hash = list.id; return; }
      setCurId(id); setSearch("");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [draft, list]);

  // Keep the sort valid for the list you're on
  useEffect(() => {
    if (!list) return;
    if (list.item_groups && order === "area") setOrder("item");
    else if (!list.item_groups && order === "item") setOrder("area");
    else if (!list.sortable && order === "story") setOrder("area");
  }, [list, order]);

  // Lists panel: docked beside the checklist on wide screens
  useEffect(() => { document.documentElement.classList.toggle("panel-open", panelOpen); }, [panelOpen]);
  const togglePanel = (open: boolean) => { setPanelOpen(open); ls.set("oot-panel-open", open); };

  // Pause live updates while editing so a co-editor's change doesn't overwrite your draft
  useEffect(() => { saves.pauseLive(editing); }, [editing, saves]);

  // Leaving the page mid-edit would lose the draft
  useEffect(() => {
    if (!editing) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing]);

  // If access to the save drops to view only mid-edit, stop editing
  useEffect(() => {
    if (draft && !saves.canEdit) { setDraft(null); notify.info("This save file is now view only, so your unsaved edits were discarded."); }
  }, [draft, saves.canEdit, notify]);

  const state: ListState = (list && (draft ? draft.after : saves.progress[list.id])) || emptyState();
  const all = useMemo(() => (list ? list.rows.map(r => eff(r, state)) : []), [list, state]);
  const q = search.trim().toLowerCase().replace(/[’']/g, "");
  const aIdx = useMemo(() => {
    const m = { ...(list?.areaIdx ?? {}) };
    all.forEach(r => { if (!(r.a in m)) m[r.a] = 1000 + Object.keys(m).length; });
    return m;
  }, [list, all]);
  const shown = useMemo(() => {
    if (!list) return [];
    const byItem = order === "item" && list.item_groups;
    const gi = (r: typeof all[number]) => (byItem ? list.item_groups!.indexOf(r.group ?? "") : aIdx[r.a]);
    const sorted = order === "story" ? all : [...all].sort((x, y) => gi(x) - gi(y) || x.n - y.n);
    return sorted.filter(r => ageOK(r, filt) && timeOK(r, tfilt) && !(hideDone && state.got.has(r.n))
      && (!q || (r.a + " " + r.l + " " + r.lv + " " + r.note).toLowerCase().replace(/[’']/g, "").includes(q)));
  }, [list, all, order, aIdx, filt, tfilt, hideDone, state, q]);

  const frac = (rows: typeof all) => `${countGot(rows, state.got)}/${rows.length}`;
  const ageCounts = Object.fromEntries((["all", "Child", "Adult", "travel"] as AgeFilter[]).map(f => [f, frac(all.filter(r => ageOK(r, f) && timeOK(r, tfilt)))])) as Record<AgeFilter, string>;
  const timeCounts = Object.fromEntries((["all", "Day", "Night"] as TimeFilter[]).map(t => [t, frac(all.filter(r => timeOK(r, t) && ageOK(r, filt)))])) as Record<TimeFilter, string>;
  const pool = all.filter(r => ageOK(r, filt) && timeOK(r, tfilt));

  // Row actions
  const onToggle = (n: number, on: boolean) => {
    if (!list) return;
    if (draft) {
      const got = new Set(draft.after.got); on ? got.add(n) : got.delete(n);
      setDraft({ ...draft, after: { ...draft.after, got } }); return;
    }
    void saves.setCollected(list.id, n, on);
  };
  const onEdit = (n: number, field: keyof RowEdit, value: string) => {
    if (!draft || !list) return;
    const r = list.rows.find(x => x.n === n)!;
    const O = { ...draft.after.O }; const next = applyEdit(r, O[n], field, value);
    if (next) O[n] = next; else delete O[n];
    setDraft({ ...draft, after: { ...draft.after, O } });
  };
  const onUndo = (n: number) => { if (!draft) return; const O = { ...draft.after.O }; delete O[n]; setDraft({ ...draft, after: { ...draft.after, O } }); };

  const startEdit = () => { if (!list) return; const cur = saves.progress[list.id] ?? emptyState(); setDraft({ before: cloneState(cur), after: cloneState(cur) }); };
  const cancelEdit = () => { setDraft(null); notify.info("Edits canceled. Nothing was saved."); };
  const doneEdit = async () => {
    if (!draft || !list || saving) return;
    const d = draft; setDraft(null); setSaving(true);
    const ok = await saves.commit(list.id, d.before, d.after);
    setSaving(false);
    if (ok) notify.ok(user ? `Saved to “${saves.active?.name}”.` : "Saved in this browser.");
  };
  const resetAll = () => { if (draft) setDraft({ ...draft, after: { ...draft.after, O: {} } }); };

  // Downloads include unsaved edits while editing
  const liveProgress = list && draft ? { ...saves.progress, [list.id]: draft.after } : saves.progress;
  const onCsv = () => {
    if (!list) return;
    try { downloadCsv(list, liveProgress); } catch (e) { notify.error("download csv", e, "Couldn't create the CSV"); }
  };
  const onXlsx = async () => {
    try {
      const name = (user && saves.active ? saves.active.name : "Ocarina Completionist").replace(/[\\/:*?"<>|]/g, " ");
      await downloadXlsx(lists, liveProgress, `${name}.xlsx`);
    } catch (e) { notify.error("download xlsx", e, "Couldn't create the Excel file"); }
  };

  if (refError) return (
    <div className="wrap crash">
      <h1>Couldn't load the checklists</h1>
      <p className="sub">{friendly(refError)}</p>
      <button className="primary" onClick={retry}>Try again</button>
    </div>
  );

  const active = saves.active;
  const readOnly = !saves.canEdit;
  // Overall completion of the open save (includes unsaved edits while editing)
  const liveAll = draft && list ? { ...saves.progress, [list.id]: draft.after } : saves.progress;
  const overall = completion(lists, liveAll);
  const joined = joinedId && saves.activeId === joinedId ? active : null;

  return <>
    <div className="wrap">
      <header className="titlebar">
        <div className="tleft">
          <button className={"ptoggle" + (panelOpen ? " on" : "")} aria-expanded={panelOpen} aria-controls="drawer" title="Toggle the lists panel" onClick={() => togglePanel(!panelOpen)}>
            <PanelIcon /><span className="vh">Lists panel</span>
          </button>
          <h1>{legal ? LEGAL_TITLES[legal] : list ? list.name : "Loading"} {list && <span>· {countGot(pool, state.got)} / {pool.length}</span>}</h1>
        </div>
        <div className="tactions">
          {/* Phones (and desktop with the lists panel closed): account button up here. Desktop: bottom of the lists panel. */}
          <button className={"acctbtn" + (user ? " in" : "")} aria-haspopup="dialog" aria-label={user ? "Account and settings" : "Sign in and settings"} onClick={() => setAcctOpen(true)}>
            <Avatar user={user} />
            <span>{user ? active?.name ?? "Account" : "Sign in"}</span>
          </button>
        </div>
      </header>
      {list && <p className="sub">{list.sub}</p>}
      {legal ? <LegalPage id={legal} /> : <>
      <div className="savebar">
        {!user ? <>Your progress is saved in this browser only. <button className="linkbtn" onClick={() => setAcctOpen(true)}>Sign in</button> to keep it on every device, use several save files and share them.</>
          : active && <>Save file: <b>{active.name}</b>{active.role !== "owner" && <> · shared with you as <b>{active.role}</b></>} <button className="linkbtn" onClick={() => setAcctOpen(true)}>Switch or share</button>
            {active.role === "viewer" && <span className="ro">View only</span>}</>}
        {lists.length > 0 && <span className="pctchip" title={`${overall.done} of ${overall.total} collected across every list`}>
          <span className="pctbar"><i style={{ width: `${overall.pct}%` }} /></span>{overall.pct}% complete</span>}
        {saving && <span className="ro">Saving…</span>}
      </div>

      {list && <FilterBar
        filt={filt} setFilt={setFilt} ageCounts={ageCounts}
        tfilt={tfilt} setTfilt={setTfilt} timeCounts={timeCounts}
        search={search} setSearch={setSearch} areaNames={[...new Set(all.map(r => r.a))]}
        editing={editing} onDone={doneEdit} onCancel={cancelEdit}
        hideDone={hideDone} setHideDone={setHideDone}
        canEdit={saves.canEdit} onStartEdit={startEdit} onCsv={onCsv} onXlsx={onXlsx}
        order={order} setOrder={setOrder} sortable={list.sortable} hasItemSort={!!list.item_groups}
      />}
      {editing && <div className="editbar">Editing: change the area, location, map level, age, time or requirements on any row. Nothing is saved until you tap Done editing.{" "}
        <button className="linkbtn" onClick={resetAll}>Reset all edits on this list</button></div>}

      {list ? <ChecklistTable list={list} rows={shown} all={all} got={state.got} order={order} editing={editing} readOnly={readOnly}
        onToggle={onToggle} onEdit={onEdit} onUndo={onUndo}
        emptyText={search ? `Nothing on this list matches “${search}” with these filters.` : "Nothing on this list matches these filters."} />
        : <div className="tablebox"><table><tbody><tr className="empty"><td>Loading the checklists…</td></tr></tbody></table></div>}
      </>}

      {list && <p className="foot"><span dangerouslySetInnerHTML={{ __html: list.foot }} /> Tap the <b>?</b> button for all sources.</p>}
      <p className="foot">Unofficial fan project, not affiliated with Nintendo. <a href="#privacy">Privacy</a> · <a href="#terms">Terms</a></p>
    </div>

    {panelOpen && lists.length > 0 && <ListsDrawer lists={lists} progress={liveAll} overallPct={overall.pct} curId={list?.id ?? ""} editing={editing}
      onPick={() => { if (!wide()) setPanelOpen(false); }} onClose={() => togglePanel(false)}
      account={<button className="acard" aria-haspopup="dialog" onClick={() => setAcctOpen(true)}>
        <Avatar user={user} />
        <span className="acard-text">
          <b>{user ? nameOf(user) : "Sign in"}</b>
          <small>{user ? active?.name ?? "Account" : "Save progress on every device"}</small>
        </span>
        <span className="acard-gear" aria-hidden="true">⚙</span>
      </button>} />}

    {!srcOpen && <button className="fab" aria-label="Show sources" aria-haspopup="dialog" onClick={() => setSrcOpen(true)}>?</button>}
    {ref && lists.length > 0 && <SourcesPanel open={srcOpen} onClose={() => setSrcOpen(false)} lists={lists} sources={ref.sources} notes={ref.notes} curId={firstId} />}
    {lists.length > 0 && <AccountPanel open={acctOpen} onClose={() => setAcctOpen(false)} user={user} recovering={recovering} onRecovered={() => setRecovering(false)}
      welcoming={welcoming} onWelcomed={() => setWelcoming(false)}
      settings={settings} setSettings={setSettings}
      lists={lists} curId={firstId} saves={saves.saves} active={active} progress={saves.progress} activeId={saves.activeId} onSwitch={id => saves.setActiveId(id)} reloadSaves={saves.loadSaves}
      guestData={hasGuestData(lists)} onCopyGuest={saves.copyGuest} onImport={saves.importCollected} />}
    {/* Opened a playthrough someone just shared: show where you are and how far along it is */}
    <Modal open={!!joined} onClose={() => setJoinedId(null)} title="You're in" labelId="joinTitle" className="acctpanel" center>
      {joined && <div className="aform welcome">
        <div className="whero">
          <span className="weyebrow">{joined.owner_email ? `${joined.owner_email.split("@")[0]}'s playthrough` : "Shared playthrough"}</span>
          <b className="wsave">{joined.name}</b>
          <span className="wrole">{joined.role === "viewer" ? "View only" : "You can check things off together"}</span>
        </div>
        <ProgressSummary c={overall} />
        <button className="primary" onClick={() => setJoinedId(null)}>Start playing</button>
      </div>}
    </Modal>
  </>;
}
