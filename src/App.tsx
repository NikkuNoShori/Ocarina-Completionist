import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useReference } from "./hooks/useReference";
import { hasGuestData, useSaves } from "./hooks/useSaves";
import { useSettings } from "./hooks/useSettings";
import { ageOK, applyEdit, cloneState, countGot, eff, emptyState, timeOK } from "./lib/rows";
import { ls } from "./lib/storage";
import type { AgeFilter, ListState, Order, RowEdit, TimeFilter } from "./lib/types";
import { AccountPanel } from "./components/AccountPanel";
import { ChecklistTable } from "./components/ChecklistTable";
import { FilterBar } from "./components/FilterBar";
import { ListsDrawer } from "./components/ListsDrawer";
import { SourcesPanel } from "./components/SourcesPanel";
import { PanelIcon, Toast } from "./components/ui";

const wide = () => window.innerWidth >= 900;

export default function App() {
  const { data: ref, error: refError } = useReference();
  const { user, recovering, setRecovering } = useAuth();
  const saves = useSaves(user, ref?.lists ?? null);
  const [settings, setSettings] = useSettings(user, saves.activeId);

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
  const [notice, setNotice] = useState<{ text: string; err?: boolean } | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; err?: boolean } | null>(null);

  const toast = useCallback((text: string, err?: boolean) => { setToastMsg({ text, err }); }, []);
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(null), 4200); return () => clearTimeout(t); }, [toastMsg]);

  const lists = ref?.lists ?? [];
  const list = lists.find(L => L.id === curId) ?? lists[0];
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
  const onToggle = async (n: number, on: boolean) => {
    if (!list) return;
    if (draft) {
      const got = new Set(draft.after.got); on ? got.add(n) : got.delete(n);
      setDraft({ ...draft, after: { ...draft.after, got } }); return;
    }
    const err = await saves.setCollected(list.id, n, on);
    if (err) toast(err, true);
  };
  const onEdit = (n: number, field: keyof RowEdit, value: string) => {
    if (!draft || !list) return;
    const r = list.rows.find(x => x.n === n)!;
    const O = { ...draft.after.O }; const next = applyEdit(r, O[n], field, value);
    if (next) O[n] = next; else delete O[n];
    setDraft({ ...draft, after: { ...draft.after, O } });
  };
  const onUndo = (n: number) => { if (!draft) return; const O = { ...draft.after.O }; delete O[n]; setDraft({ ...draft, after: { ...draft.after, O } }); };

  const startEdit = () => { if (!list) return; const cur = saves.progress[list.id] ?? emptyState(); setDraft({ before: cloneState(cur), after: cloneState(cur) }); setNotice(null); };
  const cancelEdit = () => { setDraft(null); setNotice({ text: "Edits canceled. Nothing was saved." }); };
  const doneEdit = async () => {
    if (!draft || !list) return;
    const d = draft; setDraft(null); setNotice({ text: "Saving…" });
    const err = await saves.commit(list.id, d.before, d.after);
    setNotice(err ? { text: err, err: true } : { text: user ? `Saved to “${saves.active?.name}”.` : "Saved in this browser." });
  };
  const resetAll = () => { if (draft) setDraft({ ...draft, after: { ...draft.after, O: {} } }); };

  const downloadCsv = () => {
    if (!list) return;
    const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["#", "Area", "Location", "Map Level", "Link", "Adult first", "Time", "Notes", "Collected"],
      ...all.map(r => [r.n, r.a, r.l, r.lv === "?" ? "" : r.lv, r.age, r.af ? "TRUE" : "FALSE", r.time, r.note, state.got.has(r.n) ? "TRUE" : "FALSE"])];
    const blob = new Blob([rows.map(r => r.map(cell).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${list.name}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (refError) return <div className="wrap"><p className="sub">Couldn't load the checklists. Check your connection and reload the page.</p></div>;

  const active = saves.active;
  const readOnly = !saves.canEdit;

  return <>
    <div className="wrap">
      <header className="titlebar">
        <div className="tleft">
          <button className={"ptoggle" + (panelOpen ? " on" : "")} aria-expanded={panelOpen} aria-controls="drawer" title="Toggle the lists panel" onClick={() => togglePanel(!panelOpen)}>
            <PanelIcon /><span className="vh">Lists panel</span>
          </button>
          <h1>{list ? list.name : "Loading"} {list && <span>· {countGot(pool, state.got)} / {pool.length}</span>}</h1>
        </div>
        <div className="tactions">
          <button className={"acctbtn" + (user ? " in" : "")} aria-haspopup="dialog" onClick={() => setAcctOpen(true)}>
            <span className="av" aria-hidden="true">{user ? (user.email ?? "?")[0].toUpperCase() : "?"}</span>
            <span>{user ? active?.name ?? "Account" : "Sign in"}</span>
          </button>
        </div>
      </header>
      {list && <p className="sub">{list.sub}</p>}
      <div className="savebar">
        {!user ? <>Your progress is saved in this browser only. <button className="linkbtn" onClick={() => setAcctOpen(true)}>Sign in</button> to keep it on every device, use several save files and share them.</>
          : active && <>Save file: <b>{active.name}</b>{active.role !== "owner" && <> · shared with you as <b>{active.role}</b></>} <button className="linkbtn" onClick={() => setAcctOpen(true)}>Switch or share</button>
            {active.role === "viewer" && <span className="ro">View only</span>}</>}
      </div>

      {list && <FilterBar
        filt={filt} setFilt={setFilt} ageCounts={ageCounts}
        tfilt={tfilt} setTfilt={setTfilt} timeCounts={timeCounts}
        search={search} setSearch={setSearch} areaNames={[...new Set(all.map(r => r.a))]}
        editing={editing} onDone={doneEdit} onCancel={cancelEdit}
        hideDone={hideDone} setHideDone={setHideDone}
        canEdit={saves.canEdit} onStartEdit={startEdit} onCsv={downloadCsv}
        order={order} setOrder={setOrder} sortable={list.sortable} hasItemSort={!!list.item_groups}
        settings={settings} setSettings={setSettings}
      />}
      {notice && <div className={"savemsg" + (notice.err ? " err" : "")} role="status">{notice.text}</div>}
      {editing && <div className="editbar">Editing: change the area, location, map level, age, time or requirements on any row. Nothing is saved until you tap Done editing.{" "}
        <button className="linkbtn" onClick={resetAll}>Reset all edits on this list</button></div>}

      {list ? <ChecklistTable list={list} rows={shown} all={all} got={state.got} order={order} editing={editing} readOnly={readOnly}
        onToggle={onToggle} onEdit={onEdit} onUndo={onUndo}
        emptyText={search ? `Nothing on this list matches “${search}” with these filters.` : "Nothing on this list matches these filters."} />
        : <div className="tablebox"><table><tbody><tr className="empty"><td>Loading the checklists…</td></tr></tbody></table></div>}

      {list && <p className="foot"><span dangerouslySetInnerHTML={{ __html: list.foot }} /> Tap the <b>?</b> button for all sources.</p>}
    </div>

    {panelOpen && list && <ListsDrawer lists={lists} progress={draft ? { ...saves.progress, [list.id]: draft.after } : saves.progress} curId={list.id} editing={editing}
      onPick={() => { if (!wide()) setPanelOpen(false); }} onClose={() => togglePanel(false)} />}

    {!srcOpen && <button className="fab" aria-label="Show sources" aria-haspopup="dialog" onClick={() => setSrcOpen(true)}>?</button>}
    {ref && list && <SourcesPanel open={srcOpen} onClose={() => setSrcOpen(false)} lists={lists} sources={ref.sources} notes={ref.notes} curId={list.id} />}
    {list && <AccountPanel open={acctOpen} onClose={() => setAcctOpen(false)} user={user} recovering={recovering} onRecovered={() => setRecovering(false)}
      lists={lists} curId={list.id} saves={saves.saves} active={active} onSwitch={id => saves.setActiveId(id)} reloadSaves={saves.loadSaves}
      guestData={hasGuestData(lists)} onCopyGuest={saves.copyGuest} onImport={saves.importCollected} toast={toast} />}
    <Toast msg={toastMsg} />
  </>;
}
