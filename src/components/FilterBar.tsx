import type { ReactNode } from "react";
import type { AgeFilter, Order, TimeFilter } from "../lib/types";

const AGE_LABEL: Record<AgeFilter, string> = { all: "All ages", Child: "Child", Adult: "Adult", travel: "Time travel" };
const TIME_LABEL: Record<TimeFilter, string> = { all: "Any time", Day: "Day", Night: "Night" };
const AGE_TIP = "Child tasks that need something you first get as an adult";

export function FilterBar(p: {
  filt: AgeFilter; setFilt: (f: AgeFilter) => void; ageCounts: Record<AgeFilter, string>;
  tfilt: TimeFilter; setTfilt: (t: TimeFilter) => void; timeCounts: Record<TimeFilter, string>;
  search: string; setSearch: (s: string) => void; areaNames: string[];
  editing: boolean; onDone: () => void; onCancel: () => void;
  /** Phones get an age dropdown, and the ⋮ moves up to the header */
  phone: boolean; menu: ReactNode;
}) {
  return (
    <div className="bar">
      {p.phone ? (
        <select className="sel asel" aria-label="Filter by age" value={p.filt} onChange={e => p.setFilt(e.target.value as AgeFilter)}>
          {(Object.keys(AGE_LABEL) as AgeFilter[]).map(f => <option key={f} value={f}>{AGE_LABEL[f]} ({p.ageCounts[f]})</option>)}
        </select>
      ) : (
        <div className="seg" role="group" aria-label="Filter by age">
          {(Object.keys(AGE_LABEL) as AgeFilter[]).map(f => (
            <button key={f} aria-pressed={p.filt === f} onClick={() => p.setFilt(f)} title={f === "travel" ? AGE_TIP : undefined}>
              {f === "all" ? "All" : AGE_LABEL[f]}<span className="bc">{p.ageCounts[f]}</span>
            </button>
          ))}
        </div>
      )}
      <select className="sel tsel" aria-label="Filter by time of day" value={p.tfilt} onChange={e => p.setTfilt(e.target.value as TimeFilter)}>
        {(Object.keys(TIME_LABEL) as TimeFilter[]).map(t => <option key={t} value={t}>{TIME_LABEL[t]} ({p.timeCounts[t]})</option>)}
      </select>
      {p.editing && <>
        <button className="editbtn" aria-pressed="true" onClick={p.onDone}>Done editing</button>
        <button className="editbtn cancelbtn" onClick={p.onCancel}>Cancel</button>
      </>}
      <div className="search">
        <input className="sel" type="search" list="areas" placeholder="Search locations…" aria-label="Search locations" autoComplete="off"
          value={p.search} onChange={e => p.setSearch(e.target.value)} />
        <datalist id="areas">{p.areaNames.map(a => <option key={a} value={a} />)}</datalist>
      </div>
      {p.menu}
    </div>
  );
}

/** What the list ⋮ holds: in the filter bar on wider screens, in the header on phones. */
export function ListMenuItems(p: {
  close: () => void;
  hideDone: boolean; setHideDone: (b: boolean) => void; editing: boolean;
  canEdit: boolean; onStartEdit: () => void; onCsv: () => void; onXlsx: () => void;
  order: Order; setOrder: (o: Order) => void; sortable: boolean; hasItemSort: boolean;
}) {
  const { close } = p;
  return <>
    <label className="kitem" role="menuitemcheckbox" aria-checked={p.hideDone}>
      <input type="checkbox" checked={p.hideDone} onChange={e => p.setHideDone(e.target.checked)} /> Hide collected
    </label>
    {p.canEdit && !p.editing && <button className="kitem" role="menuitem" onClick={() => { close(); p.onStartEdit(); }}>Edit details</button>}
    <button className="kitem" role="menuitem" onClick={() => { close(); p.onCsv(); }}>Download this list (CSV)</button>
    <button className="kitem" role="menuitem" onClick={() => { close(); p.onXlsx(); }}>Download all lists (Excel)</button>
    {p.sortable && (
      <div className="ksec" role="group" aria-label="Sort">
        <div className="klabel">Sort</div>
        {p.hasItemSort && <button className="kitem kradio" role="menuitemradio" aria-pressed={p.order === "item"} onClick={() => { close(); p.setOrder("item"); }}>By item</button>}
        {!p.hasItemSort && <button className="kitem kradio" role="menuitemradio" aria-pressed={p.order === "area"} onClick={() => { close(); p.setOrder("area"); }}>By area</button>}
        <button className="kitem kradio" role="menuitemradio" aria-pressed={p.order === "story"} onClick={() => { close(); p.setOrder("story"); }}>Story order</button>
      </div>
    )}
  </>;
}
