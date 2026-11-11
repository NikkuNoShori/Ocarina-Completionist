import { sb } from "./lib/supabase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AccountPanel, type AcctView } from "./components/AccountPanel";
import { ChecklistTable } from "./components/ChecklistTable";
import { FilterBar, ListMenuItems } from "./components/FilterBar";
import { MoreMenu } from "./components/MoreMenu";
import { orderFor, useFilterPrefs, useMedia } from "./lib/filters";
import { ALL_ID, buildAll, combineState } from "./lib/allview";
import { LEGAL_TITLES, LegalPage, type LegalId } from "./components/LegalPage";
import { ListsDrawer } from "./components/ListsDrawer";
import { Avatar, nameOf } from "./components/Avatar";
import { useNotify } from "./components/Notify";
import { SourcesPanel } from "./components/SourcesPanel";
import { ProgressSummary } from "./components/ProgressSummary";
import { Modal, PanelIcon } from "./components/ui";
import { PublishPreview, ReviewUpdates, UpdateMessage } from "./components/RowUpdates";
import { GuideChanges } from "./components/GuideChanges";

const wide = () => window.innerWidth >= 900;

export default function App() {
  const notify = useNotify();
  const { data: ref, error: refError, retry } = useReference();
  const { user, recovering, setRecovering, welcoming, setWelcoming } = useAuth(notify);
  const saves = useSaves(user, ref?.lists ?? null, notify);
  const [settings, setSettings] = useSettings(user, saves.activeId);
  // "Alex shared … with you" notices; Open switches to that save file (reloading the list first in case it's new)
  const [joinedId, setJoinedId] = useState<string | null>(null);
  useNotifications(user, notify, async id => { await saves.loadSaves(); saves.setActiveId(id); setJoinedId(id); if (page) location.hash = ""; }, welcoming);

  const [curId, setCurId] = useState(() => window.location.hash.slice(1));
  // Filters are remembered across lists and visits (src/lib/filters.ts)
  const { prefs, update: updatePrefs, setOrder: saveOrder } = useFilterPrefs();
  const filt = prefs.age, tfilt = prefs.time, hideDone = prefs.hideDone;
  const setFilt = (age: AgeFilter) => updatePrefs({ age });
  const setTfilt = (time: TimeFilter) => updatePrefs({ time });
  const setHideDone = (b: boolean) => updatePrefs({ hideDone: b });
  const setShowGuides = (b: boolean) => updatePrefs({ showGuides: b });
  // Search text is remembered for the list it was set on, so it survives the page reloading
  // (phones often reload a tab you switched away from). Switching lists clears it.
  const FIND_KEY = "oot-find-v1";
  const savedFind = (() => { const f = ls.get<{ list?: string; search?: string } | null>(FIND_KEY, null); return f && f.list === window.location.hash.slice(1) ? f : null; })();
  const [search, setSearch] = useState(() => (typeof savedFind?.search === "string" ? savedFind.search : ""));
  // The area pick is remembered everywhere (filters.ts), so "Hyrule Field" follows you from list to list
  const area = prefs.area;
  const setArea = (a: string) => updatePrefs({ area: a });
  const phone = useMedia("(max-width:640px)");
  // Below desktop width the lists open as a bottom sheet from the title in a sticky top bar
  const compact = useMedia("(max-width:899px)");
  // Crossing into phone/tablet width closes the panel (it would otherwise pop up as a sheet); back to desktop restores it
  useEffect(() => { setPanelOpen(compact ? false : ls.get("oot-panel-open", true)); }, [compact]);
  const [draft, setDraft] = useState<{ before: ListState; after: ListState } | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => (wide() ? ls.get("oot-panel-open", true) : false));
  const [srcOpen, setSrcOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  // On desktop the account menu pops out beside whatever opened it
  const [acctFrom, setAcctFrom] = useState<{ el: HTMLElement | null; view?: AcctView }>({ el: null });
  const closeAcct = useCallback(() => setAcctOpen(false), []);
  const openAcct = (e: { currentTarget: HTMLElement }, view?: AcctView) => { setAcctFrom({ el: e.currentTarget, view }); setAcctOpen(true); };
  const [saving, setSaving] = useState(false);

  const lists = ref?.lists ?? [];
  // #privacy and #terms are pages too; anything else is a checklist id
  const legal: LegalId | null = curId === "privacy" || curId === "terms" ? curId : null;
  // #changes: the history of updates published to the guide
  const page: LegalId | "changes" | null = legal ?? (curId === "changes" ? "changes" : null);
  // #all is the combined view of every list
  const allView = useMemo(() => (lists.length ? buildAll(lists) : null), [lists]);
  const isAll = !page && curId === ALL_ID && !!allView;
  const list = page ? undefined : isAll ? allView!.list : lists.find(L => L.id === curId) ?? lists[0];
  const firstId = (isAll ? lists[0]?.id : list?.id) ?? lists[0]?.id ?? "";
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

  // Sort is remembered per list, falling back to what that list supports
  const order: Order = list ? orderFor(list, prefs.order[list.id]) : "area";
  const setOrder = (o: Order) => { if (list) saveOrder(list.id, o); };

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

  const state: ListState = useMemo(() => isAll ? combineState(lists, saves.progress)
    : (list && (draft ? draft.after : saves.progress[list.id])) || emptyState(), [isAll, lists, saves.progress, list, draft]);
  const all = useMemo(() => (list ? list.rows.map(r => {
    const e = eff(r, state);
    return isAll && allView ? { ...e, dn: allView.decode(r.n).n, tag: allView.tag(r.n) } : e;
  }) : []), [list, state, isAll, allView]);
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
    return sorted.filter(r => ageOK(r, filt) && timeOK(r, tfilt) && !(hideDone && state.got.has(r.n)) && (!area || r.a === area)
      && (!q || (r.a + " " + r.l + " " + r.lv + " " + r.note).toLowerCase().replace(/[’']/g, "").includes(q)));
  }, [list, all, order, aIdx, filt, tfilt, hideDone, state, q, area]);

  const frac = (rows: typeof all) => `${countGot(rows, state.got)}/${rows.length}`;
  const ageCounts = Object.fromEntries((["all", "Child", "Adult", "travel"] as AgeFilter[]).map(f => [f, frac(all.filter(r => ageOK(r, f) && timeOK(r, tfilt)))])) as Record<AgeFilter, string>;
  const timeCounts = Object.fromEntries((["all", "Day", "Night"] as TimeFilter[]).map(t => [t, frac(all.filter(r => timeOK(r, t) && ageOK(r, filt)))])) as Record<TimeFilter, string>;
  const pool = all.filter(r => ageOK(r, filt) && timeOK(r, tfilt));
  // Areas in the order the list shows them, with how many you've got in each (age/time filters applied)
  const areaOpts = useMemo(() => {
    const m = new Map<string, typeof all>();
    for (const r of [...pool].sort((x, y) => aIdx[x.a] - aIdx[y.a])) m.set(r.a, [...(m.get(r.a) ?? []), r]);
    return [...m].map(([name, rows]) => ({ name, count: frac(rows) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length, filt, tfilt, aIdx, state]);
  useEffect(() => { if (list) ls.set(FIND_KEY, { list: list.id, search }); }, [list, search]);
  // The text search only exists on wider screens
  useEffect(() => { if (phone) setSearch(""); }, [phone]);

  // Row actions
  const onToggle = (n: number, on: boolean) => {
    if (!list) return;
    if (isAll && allView) { const d = allView.decode(n); void saves.setCollected(d.listId, d.n, on); return; }
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

  // Rows you edited that were updated in the shared list since: compare and choose
  const [review, setReview] = useState<number[] | null | false>(false);
  const staleCount = isAll ? 0 : all.filter(r => r.stale).length;
  useEffect(() => { setReview(false); }, [list?.id]);
  // Close the comparison once everything in it is settled
  useEffect(() => {
    if (review !== false && !all.some(r => r.stale && (!review || review.includes(r.n)))) setReview(false);
  }, [all, review]);
  const resolve = async (useShared: number[], keep: { n: number; at: string }[]) => {
    if (!list) return;
    const ok = await saves.resolveUpdates(list.id, saves.progress[list.id] ?? emptyState(), useShared, keep);
    if (!ok) return;
    if (useShared.length && !keep.length) notify.ok(useShared.length === 1 ? `Approved. #${useShared[0]} now has the new info.` : `Approved. ${useShared.length} spots now have the new info.`);
    else if (keep.length && !useShared.length) notify.ok(keep.length === 1 ? `Kept your version of #${keep[0].n}.` : `Kept your version of ${keep.length} spots.`);
  };

  const startEdit = () => { if (!list || isAll) return; const cur = saves.progress[list.id] ?? emptyState(); setDraft({ before: cloneState(cur), after: cloneState(cur) }); };
  const cancelEdit = () => { setDraft(null); notify.info("Edits canceled. Nothing was saved."); };
  const dirty = !!draft && JSON.stringify(draft.before.O) !== JSON.stringify(draft.after.O);
  // Undo puts back only the details you edited, never checkmarks made since
  const progressRef = useRef(saves.progress); progressRef.current = saves.progress;
  const doneEdit = async () => {
    if (!draft || !list || saving) return;
    const d = draft; setDraft(null); setSaving(true);
    const ok = await saves.commit(list.id, d.before, d.after);
    setSaving(false);
    if (ok && JSON.stringify(d.before.O) !== JSON.stringify(d.after.O)) notify.ok(user ? `Saved to “${saves.active?.name}”.` : "Saved in this browser.", {
      label: "Undo", run: async () => {
        const got = progressRef.current[list.id]?.got ?? d.after.got;
        if (await saves.commit(list.id, { got, O: d.after.O }, { got, O: d.before.O })) notify.info("Edits undone.");
      },
    });
  };
  // Admins can push this save's edits on a list into the shared list for everyone
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    sb.rpc("am_i_admin").then(({ data, error }) => { if (!error) setIsAdmin(!!data); });
  }, [user]);
  const editCount = list ? Object.keys(saves.progress[list.id]?.O ?? {}).length : 0;
  // Publishing opens a preview of every change first
  const [pubOpen, setPubOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const publishEdits = async () => {
    if (!list || !saves.activeId || publishing) return;
    setPublishing(true);
    try { await doPublish(); } finally { setPublishing(false); setPubOpen(false); }
  };
  const doPublish = async () => {
    if (!list || !saves.activeId) return;
    const saveId = saves.activeId, listId = list.id, since = new Date(Date.now() - 60_000).toISOString();
    const before = saves.progress[list.id]?.O ?? {};
    const { data, error } = await sb.rpc("publish_save_edits", { p_save: saveId, p_list: listId });
    if (error) return notify.error("publish edits", error, "Couldn't publish the edits");
    // The edits now live in the shared list: drop them from this save and fetch the new list
    saves.setProgress(p => ({ ...p, [list.id]: { ...(p[list.id] ?? emptyState()), O: {} } }));
    await retry();
    notify.ok(`Published ${data} edit${data === 1 ? "" : "s"} to everyone's ${list.name} list.`, {
      label: "Undo", run: async () => {
        const { error: e } = await sb.rpc("undo_publish", { p_save: saveId, p_list: listId, p_since: since });
        if (e) return notify.error("undo publish", e, "Couldn't undo the publish");
        saves.setProgress(p => ({ ...p, [listId]: { ...(p[listId] ?? emptyState()), O: { ...before, ...(p[listId]?.O ?? {}) } } }));
        await retry();
        notify.info("Publish undone. The edits are back on your save only.");
      },
    });
  };
  const resetAll = () => {
    if (!draft) return;
    const kept = draft.after.O;
    setDraft({ ...draft, after: { ...draft.after, O: {} } });
    notify.info("Cleared every edit on this list. Nothing is saved until you tap Done editing.", {
      label: "Undo", run: () => setDraft(cur => cur && { ...cur, after: { ...cur.after, O: { ...kept, ...cur.after.O } } }),
    });
  };

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

  const listMenu = list && !page ? <MoreMenu items={close => <ListMenuItems close={close}
    hideDone={hideDone} setHideDone={setHideDone} editing={editing}
    showGuides={prefs.showGuides} setShowGuides={setShowGuides}
    canEdit={saves.canEdit} onStartEdit={startEdit} onCsv={onCsv} onXlsx={onXlsx}
    publishCount={isAdmin && user ? editCount : 0} onPublish={() => setPubOpen(true)}
    order={order} setOrder={setOrder} sortable={list.sortable} hasItemSort={!!list.item_groups} allView={isAll} />} /> : null;

  return <>
    <div className="wrap">
      {(() => {
        const title = legal ? LEGAL_TITLES[legal] : page === "changes" ? "Guide updates" : list ? list.name : "Loading";
        const got = list ? countGot(pool, state.got) : 0, pc = pool.length ? Math.round(got / pool.length * 100) : 0;
        const meta = list && <p className="tmeta">
          <span className="tstat tl" title={`${got} of ${pool.length} on this list, with the age and time filters applied`}>
            <b className="tpct">{pc}%</b> {isAll ? "this view" : "this list"}<span className="tbar" aria-hidden="true"><i style={{ width: `${pc}%` }} /></span></span>
          <span className="tsep" aria-hidden="true">|</span>
          <span className="tstat tr" title={`${overall.done} of ${overall.total} collected across every list in this save file`}>
            <b className="tpct">{overall.pct}%</b> overall<span className="tbar" aria-hidden="true"><i style={{ width: `${overall.pct}%` }} /></span></span>
        </p>;
        const actions = <div className="tactions">
          {/* Phones: the list ⋮ sits beside the avatar */}
          {phone && listMenu}
          {/* Phones/tablets (and desktop with the lists panel closed): account button up here. Desktop: bottom of the lists panel. */}
          <button className={"acctbtn" + (user ? " in" : "")} aria-haspopup="dialog" aria-label={user ? "Account and settings" : "Sign in and settings"} aria-expanded={acctOpen} onClick={e => acctOpen ? setAcctOpen(false) : openAcct(e)}>
            <Avatar user={user} />
            <span>{user ? active?.name ?? "Account" : "Sign in"}</span>
          </button>
        </div>;
        return compact ? <>
          <header className="appbar">
            <h1><button className="lpick" aria-haspopup="dialog" aria-expanded={panelOpen} aria-controls="drawer" onClick={() => setPanelOpen(o => !o)}>
              <span className="lpname">{title}</span>
              <svg className="lpchev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              <span className="vh"> (switch list)</span>
            </button></h1>
            {actions}
          </header>
          <div className="titlebar tsub">{meta}</div>
        </> : (
          <header className="titlebar">
            <div className="tleft">
              <button className={"ptoggle" + (panelOpen ? " on" : "")} aria-expanded={panelOpen} aria-controls="drawer" title="Toggle the lists panel" onClick={() => togglePanel(!panelOpen)}>
                <PanelIcon /><span className="vh">Lists panel</span>
              </button>
              <div className="ttext"><h1>{title}</h1>{meta}</div>
            </div>
            {actions}
          </header>
        );
      })()}
      {list && <p className="sub">{list.sub}</p>}
      {legal ? <LegalPage id={legal} /> : page === "changes" ? <GuideChanges lists={lists} /> : <>
      <div className="overall">
        {user && active?.role === "viewer" && <span className="ro">View only</span>}
        {saving && <span className="ro">Saving…</span>}
        {!user && <span className="ovguest">Saved in this browser only · <button className="linkbtn" onClick={openAcct}>Sign in</button> to sync</span>}
      </div>

      {list && <FilterBar
        filt={filt} setFilt={setFilt} ageCounts={ageCounts}
        tfilt={tfilt} setTfilt={setTfilt} timeCounts={timeCounts}
        search={search} setSearch={setSearch}
        area={area} setArea={setArea} areaOpts={areaOpts} areaTotal={frac(pool)}
        editing={editing} onDone={doneEdit} onCancel={cancelEdit} dirty={dirty} onReset={resetAll}
        phone={phone} menu={phone ? null : listMenu}
      />}
      {list && !editing && staleCount > 0 && <div className="upbanner" role="status">
        <UpdateMessage />
        <button className="primary sm" onClick={() => setReview(null)}>Review {staleCount} update{staleCount === 1 ? "" : "s"}</button>
      </div>}
      {editing && <div className="editbar">Editing: change the area, location, floor, age, time or requirements on any row. Nothing is saved until you tap Done editing.</div>}

      {list ? <ChecklistTable list={list} rows={shown} all={isAll && area ? all.filter(r => r.a === area) : all} got={state.got} order={order} editing={editing} readOnly={readOnly}
        onToggle={onToggle} onEdit={onEdit} onUndo={onUndo} onReview={isAll ? undefined : n => setReview([n])} showGuides={prefs.showGuides}
        emptyText={search ? `Nothing on this list matches “${search}” with these filters.` : area ? `Nothing in ${area} on this list matches these filters. Pick “All areas” or open All checklists.` : "Nothing on this list matches these filters."} />
        : <div className="tablebox"><table><tbody><tr className="empty"><td>Loading the checklists…</td></tr></tbody></table></div>}
      </>}

      {list && <p className="foot">{list.foot && <span dangerouslySetInnerHTML={{ __html: list.foot }} />} Tap the <b>?</b> button for all sources.</p>}
      <p className="foot">Unofficial fan project, not affiliated with Nintendo. <a href="#changes">Guide updates</a> · <a href="#privacy">Privacy</a> · <a href="#terms">Terms</a></p>
    </div>

    {panelOpen && lists.length > 0 && <ListsDrawer lists={lists} progress={liveAll} overallPct={overall.pct} curId={list?.id ?? ""} editing={editing}
      sheet={compact} onPick={() => { if (!wide()) setPanelOpen(false); }} onClose={() => compact ? setPanelOpen(false) : togglePanel(false)}
      account={<button className="acard" aria-haspopup="dialog" aria-expanded={acctOpen} onClick={e => acctOpen ? setAcctOpen(false) : openAcct(e)}>
        <Avatar user={user} />
        <span className="acard-text">
          <b>{user ? nameOf(user) : "Sign in"}</b>
          <small>{user ? active?.name ?? "Account" : "Save progress on every device"}</small>
        </span>
        <span className="acard-gear" aria-hidden="true">⚙</span>
      </button>} />}

    {!srcOpen && <button className="fab" aria-label="Show sources" aria-haspopup="dialog" onClick={() => setSrcOpen(true)}>?</button>}
    {ref && lists.length > 0 && <SourcesPanel open={srcOpen} onClose={() => setSrcOpen(false)} lists={lists} sources={ref.sources} notes={ref.notes} curId={firstId} />}
    {lists.length > 0 && <AccountPanel open={acctOpen} onClose={closeAcct} anchor={acctFrom.el} startView={acctFrom.view} user={user} recovering={recovering} onRecovered={() => setRecovering(false)}
      welcoming={welcoming} onWelcomed={() => setWelcoming(false)}
      settings={settings} setSettings={setSettings}
      lists={lists} curId={firstId} saves={saves.saves} active={active} progress={saves.progress} activeId={saves.activeId} onSwitch={id => saves.setActiveId(id)} reloadSaves={saves.loadSaves}
      guestData={hasGuestData(lists)} onCopyGuest={saves.copyGuest} onImport={saves.importCollected} />}
    {list && <PublishPreview open={pubOpen} onClose={() => setPubOpen(false)} list={list} st={saves.progress[list.id] ?? emptyState()}
      saveName={active?.name} busy={publishing} onPublish={publishEdits} />}
    {list && !editing && <ReviewUpdates open={review !== false} onClose={() => setReview(false)} list={list} st={state}
      only={review || null} readOnly={readOnly} onResolve={resolve} />}
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
