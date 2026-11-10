import { Fragment } from "react";
import { DUNGEONS } from "../lib/rows";
import type { ChecklistList, EffRow, Order, RowEdit } from "../lib/types";

const AGES = ["Child", "Adult", "Either", "Both"];
const TIMES = ["Any", "Day", "Night"];

/** "RPG Site steps ↗" → "RPG Site steps" (the chip draws its own arrow). */
const linkName = (label: string) => label.replace(/\s*↗\s*$/, "");

/** Pill text that reads on its own, and a hint for the less obvious ones. */
const AGE_TEXT: Record<string, string> = { Either: "Either age", Both: "Both ages" };
const AGE_TIP: Record<string, string> = { Either: "Child or adult Link can do it", Both: "Needs a visit as child and as adult" };

export function ChecklistTable({ list, rows, all, got, order, editing, readOnly, onToggle, onEdit, onUndo, emptyText, showGuides = true }: {
  list: ChecklistList; rows: EffRow[]; all: EffRow[]; got: Set<number>; order: Order; editing: boolean; readOnly: boolean;
  onToggle: (n: number, on: boolean) => void; onEdit: (n: number, field: keyof RowEdit, value: string) => void; onUndo: (n: number) => void;
  emptyText: string; showGuides?: boolean;
}) {
  const byItem = order === "item" && !!list.item_groups;
  const groupOf = (r: EffRow) => (byItem ? r.group ?? "" : r.a);
  const areas = Object.keys(list.areaIdx).sort((x, y) => x.localeCompare(y));
  const P = list.id;
  let last: string | null = null;

  return (
    <div className="tablebox">
      <table className={editing ? "editing" : undefined}>
        <thead><tr><th></th><th>#</th><th>Location</th><th>Floor</th><th>Age</th><th>Time</th><th>{list.req_label}</th>{showGuides && <th>Guides</th>}</tr></thead>
        <tbody>
          {!rows.length && <tr className="empty"><td colSpan={showGuides ? 8 : 7}>{emptyText}</td></tr>}
          {rows.map(r => {
            const k = groupOf(r);
            let head = null;
            if (k !== last) {
              const inG = all.filter(x => groupOf(x) === k), g = inG.filter(x => got.has(x.n)).length;
              head = <tr className="area"><td colSpan={showGuides ? 8 : 7}><div className="ahead"><span>{k}</span><span className={"acount" + (g === inG.length ? " full" : "")}>{g} / {inG.length}</span></div></td></tr>;
              last = k;
            }
            const done = got.has(r.n);
            return (
              <Fragment key={r.n}>
                {head}
                <tr className={done ? "done" : undefined}>
                  <td className="c"><input type="checkbox" className="chk" id={`${P}-c${r.n}`} checked={done} disabled={readOnly}
                    aria-label={`Collected #${r.n}`} onChange={e => onToggle(r.n, e.target.checked)} /></td>
                  <td className="n">{r.n}</td>
                  <td className="loc">
                    {editing ? <>
                      <select className="ed area-ed" id={`${P}-ar${r.n}`} aria-label={`Area for #${r.n}`} value={r.a} onChange={e => onEdit(r.n, "a", e.target.value)}>
                        {(areas.includes(r.a) ? areas : [r.a, ...areas]).map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <textarea key={r.l} className="ed" id={`${P}-l${r.n}`} aria-label={`Location for #${r.n}`} defaultValue={r.l} onBlur={e => e.target.value.trim() !== r.l && onEdit(r.n, "l", e.target.value.trim())} />
                    </> : <>{byItem && <div className="rowarea">{r.a}</div>}{r.l}</>}
                    {r.edited && <><span className="edited">Edited</span>{editing && <button className="linkbtn undo" onClick={() => onUndo(r.n)}>Undo</button>}</>}
                  </td>
                  <td className="lvc">
                    {(editing || r.lv) && <span className="clab" aria-hidden="true">Floor</span>}
                    {editing
                      ? (DUNGEONS.has(r.a) || r.lv) && <input key={r.lv} className="ed lv" id={`${P}-v${r.n}`} aria-label={`Map level for #${r.n}`} placeholder="e.g. B1"
                          defaultValue={r.lv === "?" ? "" : r.lv} onBlur={e => onEdit(r.n, "lv", e.target.value.trim())} />
                      : r.lv === "?" ? <span className="lvq" title="The guides don't say which floor yet">?</span> : r.lv ? <span className="lvtag">{r.lv}</span> : null}
                  </td>
                  <td className="agec">
                    <span className="clab" aria-hidden="true">Age</span>
                    {editing ? <>
                      <select className="ed" id={`${P}-a${r.n}`} aria-label={`Link age for #${r.n}`} value={r.age} onChange={e => onEdit(r.n, "age", e.target.value)}>
                        {AGES.map(a => <option key={a}>{a}</option>)}
                      </select>
                      <label className="aftog"><input type="checkbox" id={`${P}-f${r.n}`} checked={r.af} onChange={e => onEdit(r.n, "af", e.target.checked ? "1" : "0")} /> Adult first</label>
                    </> : <>
                      <span className={"pill " + r.age} title={AGE_TIP[r.age]}>{AGE_TEXT[r.age] ?? r.age}</span>
                      {r.af && r.age !== "Adult" && <span className="afirst" title="Needs a song learned as adult, then travel back to childhood">Adult first</span>}
                    </>}
                  </td>
                  <td className="timec">
                    <span className="clab" aria-hidden="true">Time</span>
                    {editing
                      ? <select className="ed" id={`${P}-t${r.n}`} aria-label={`Time for #${r.n}`} value={r.time} onChange={e => onEdit(r.n, "time", e.target.value)}>{TIMES.map(t => <option key={t}>{t}</option>)}</select>
                      : <span className={"pill " + r.time}>{r.time === "Any" ? "Any time" : r.time}</span>}
                  </td>
                  <td className={"req" + (!editing && !r.note ? " none" : "")}>
                    <span className="clab" aria-hidden="true">{list.req_label}</span>
                    {editing
                      ? <input key={r.note} className="ed" id={`${P}-r${r.n}`} aria-label={`Requirements for #${r.n}`} defaultValue={r.note} onBlur={e => e.target.value.trim() !== r.note && onEdit(r.n, "note", e.target.value.trim())} />
                      : r.note || "—"}
                  </td>
                  {showGuides && <td className={"guides" + (r.links.length ? "" : " none")}>
                    <span className="clab" aria-hidden="true">Guides</span>
                    {r.links.length > 0 && <span className="gchips">{r.links.map(x => (
                      <a key={x.href + x.label} className="gchip" href={x.href} target="_blank" rel="noopener" title={`Open ${linkName(x.label)} in a new tab`}>
                        {linkName(x.label)}
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
                      </a>))}</span>}
                  </td>}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
