import type { ReactNode } from "react";
import { ConfirmButton } from "./ui";
import type { AgeFilter, Order, TimeFilter } from "../lib/types";

const AGE_LABEL: Record<AgeFilter, string> = { all: "All ages", Child: "Child", Adult: "Adult", travel: "Time travel" };
const TIME_LABEL: Record<TimeFilter, string> = { all: "Any time", Day: "Day", Night: "Night" };
const AGE_TIP = "Child tasks that need something you first get as an adult";

export function FilterBar(p: {
  filt: AgeFilter; setFilt: (f: AgeFilter) => void; ageCounts: Record<AgeFilter, string>;
  tfilt: TimeFilter; setTfilt: (t: TimeFilter) => void; timeCounts: Record<TimeFilter, string>;
  search: string; setSearch: (s: string) => void;
  editing: boolean; onDone: () => void; onCancel: () => void;
  /** Unsaved edits exist: Cancel then needs a second tap */
  dirty?: boolean; onReset: () => void;
  area: string; setArea: (a: string) => void; areaOpts: { name: string; count: string }[]; areaTotal: string;
  /** Phones get dropdowns (age, time, area), and the ⋮ moves up to the header */
  phone: boolean; menu: ReactNode;
}) {
  return (
    <div className={"bar" + (p.editing ? " editing" : "")}>
      {p.phone ? (
        <label className="fld f-age"><span className="flab">Age</span>
          <select className="sel asel" value={p.filt} onChange={e => p.setFilt(e.target.value as AgeFilter)}>
            {(Object.keys(AGE_LABEL) as AgeFilter[]).map(f => <option key={f} value={f}>{AGE_LABEL[f]} ({p.ageCounts[f]})</option>)}
          </select>
        </label>
      ) : (
        <div className="fld f-age" role="group" aria-labelledby="flab-age"><span className="flab" id="flab-age">Age</span>
          <div className="seg">
            {(Object.keys(AGE_LABEL) as AgeFilter[]).map(f => (
              <button key={f} aria-pressed={p.filt === f} onClick={() => p.setFilt(f)} title={f === "travel" ? AGE_TIP : undefined}>
                {f === "all" ? "All" : AGE_LABEL[f]}<span className="bc">{p.ageCounts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="fld f-time"><span className="flab">Time of day</span>
        <select className="sel tsel" value={p.tfilt} onChange={e => p.setTfilt(e.target.value as TimeFilter)}>
          {(Object.keys(TIME_LABEL) as TimeFilter[]).map(t => <option key={t} value={t}>{TIME_LABEL[t]} ({p.timeCounts[t]})</option>)}
        </select>
      </label>
      <label className="fld f-area"><span className="flab">Area</span>
        <select className="sel" value={p.area} onChange={e => p.setArea(e.target.value)}>
          <option value="">All areas ({p.areaTotal})</option>
          {p.area && !p.areaOpts.some(o => o.name === p.area) && <option value={p.area}>{p.area} (0)</option>}
          {p.areaOpts.map(o => <option key={o.name} value={o.name}>{o.name} ({o.count})</option>)}
        </select>
      </label>
      {!p.phone && (
        <label className="fld f-search search"><span className="flab">Search</span>
          <input className="sel" type="search" placeholder="Location or item…" autoComplete="off"
            value={p.search} onChange={e => p.setSearch(e.target.value)} />
        </label>
      )}
      {p.editing && <div className="fld f-edit">
        <ConfirmButton className="editbtn resetbtn" label="Reset all edits" confirmLabel="Tap again to reset this list" onConfirm={p.onReset} />
        <span className="espacer" aria-hidden="true" />
        <button className="editbtn" aria-pressed="true" onClick={p.onDone}>Done editing</button>
        {p.dirty
          ? <ConfirmButton className="editbtn cancelbtn" label="Cancel" confirmLabel="Discard changes?" onConfirm={p.onCancel} />
          : <button className="editbtn cancelbtn" onClick={p.onCancel}>Cancel</button>}
      </div>}
      {p.menu && <div className="fld f-menu">{p.menu}</div>}
    </div>
  );
}

/** What the list ⋮ holds: in the filter bar on wider screens, in the header on phones. */
export function ListMenuItems(p: {
  close: () => void;
  hideDone: boolean; setHideDone: (b: boolean) => void; editing: boolean;
  showGuides: boolean; setShowGuides: (b: boolean) => void;
  canEdit: boolean; onStartEdit: () => void; onCsv: () => void; onXlsx: () => void;
  /** Admins: how many of this save's edits on this list can be published to everyone */
  publishCount: number; onPublish: () => void;
  order: Order; setOrder: (o: Order) => void; sortable: boolean; hasItemSort: boolean;
  /** All checklists view */
  allView?: boolean;
}) {
  const { close } = p;
  return <>
    <label className="kitem" role="menuitemcheckbox" aria-checked={p.hideDone}>
      <input type="checkbox" checked={p.hideDone} onChange={e => p.setHideDone(e.target.checked)} /> Hide collected
    </label>
    <label className="kitem" role="menuitemcheckbox" aria-checked={p.showGuides}>
      <input type="checkbox" checked={p.showGuides} onChange={e => p.setShowGuides(e.target.checked)} /> Show guide links
    </label>
    {p.canEdit && !p.editing && !p.allView && <button className="kitem" role="menuitem" onClick={() => { close(); p.onStartEdit(); }}>Edit details</button>}
    {p.publishCount > 0 && !p.editing && <button className="kitem kpub" role="menuitem" aria-haspopup="dialog" onClick={() => { close(); p.onPublish(); }}>
      Review &amp; publish {p.publishCount} edit{p.publishCount === 1 ? "" : "s"}…</button>}
    {!p.allView && <button className="kitem" role="menuitem" onClick={() => { close(); p.onCsv(); }}>Download this list (CSV)</button>}
    <button className="kitem" role="menuitem" onClick={() => { close(); p.onXlsx(); }}>Download all lists (Excel)</button>
    {(p.sortable || p.allView) && (
      <div className="ksec" role="group" aria-label="Sort">
        <div className="klabel">Sort</div>
        {p.hasItemSort && <button className="kitem kradio" role="menuitemradio" aria-pressed={p.order === "item"} onClick={() => { close(); p.setOrder("item"); }}>{p.allView ? "By list" : "By item"}</button>}
        {(!p.hasItemSort || p.allView) && <button className="kitem kradio" role="menuitemradio" aria-pressed={p.order === "area"} onClick={() => { close(); p.setOrder("area"); }}>By area</button>}
        {!p.allView && <button className="kitem kradio" role="menuitemradio" aria-pressed={p.order === "story"} onClick={() => { close(); p.setOrder("story"); }}>Story order</button>}
      </div>
    )}
  </>;
}
