import { Modal } from "./ui";
import { FIELD_NAMES, fieldDiff, isStale, showValue } from "../lib/rows";
import type { ChecklistList, ItemRow, ListState, RowEdit } from "../lib/types";

const fieldName = (list: ChecklistList, k: keyof RowEdit) => (k === "note" ? list.req_label || FIELD_NAMES.note : FIELD_NAMES[k]);
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

/** One row's changed fields as a small two-column comparison. */
function Diff({ list, r, o, left, right }: { list: ChecklistList; r: ItemRow; o: RowEdit; left: string; right: string }) {
  const d = fieldDiff(r, o);
  return (
    <table className="difft">
      <thead><tr><th scope="col">Field</th><th scope="col">{left}</th><th scope="col">{right}</th></tr></thead>
      <tbody>
        {d.map(x => (
          <tr key={x.k}>
            <th scope="row">{fieldName(list, x.k)}</th>
            <td className="dold">{showValue(x.k, x.base)}</td>
            <td className="dnew">{showValue(x.k, x.mine)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const RowHead = ({ r }: { r: ItemRow }) => (
  <div className="drowhead"><span className="dnum">#{r.n}</span><span><b>{r.area}</b> · {r.location}</span></div>
);

/** Admins: every change a publish will make to the shared list, before it goes out. */
export function PublishPreview({ open, onClose, list, st, saveName, busy, onPublish }: {
  open: boolean; onClose: () => void; list: ChecklistList; st: ListState; saveName?: string; busy: boolean; onPublish: () => void;
}) {
  const rows = list.rows.filter(r => st.O[r.n] && fieldDiff(r, st.O[r.n]).length);
  const n = rows.length, s = n === 1 ? "" : "s";
  return (
    <Modal open={open} onClose={onClose} title={`Publish ${n} edit${s} to ${list.name}`} labelId="pubTitle" className="diffpanel" center>
      <p>These changes go into the shared list for every player. They come from your save file{saveName ? <> “{saveName}”</> : null}.</p>
      <ul className="dnotes">
        <li>No one's checkmarks change.</li>
        <li>Players who edited the same rows keep their version, and get a notice to compare it with yours.</li>
        <li>You can undo for a short time after publishing.</li>
      </ul>
      <div className="dlist">
        {rows.map(r => (
          <section key={r.n} className="ditem">
            <RowHead r={r} />
            <Diff list={list} r={r} o={st.O[r.n]} left="Before" right="After" />
          </section>
        ))}
      </div>
      <div className="dactions">
        <button className="editbtn" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={busy || !n} onClick={onPublish}>{busy ? "Publishing…" : `Publish ${n} edit${s}`}</button>
      </div>
    </Modal>
  );
}

/** Players: rows they edited that an admin has since updated. Compare, then keep theirs or take the new one. */
export function ReviewUpdates({ open, onClose, list, st, only, readOnly, onResolve }: {
  open: boolean; onClose: () => void; list: ChecklistList; st: ListState;
  /** Limit to these row numbers (opened from one row's notice); all stale rows otherwise */
  only: number[] | null; readOnly: boolean;
  onResolve: (useShared: number[], keep: { n: number; at: string }[]) => void;
}) {
  const rows = list.rows.filter(r => isStale(r, st) && (!only || only.includes(r.n)));
  // Mark as reviewed no earlier than the update itself (clocks can differ a little)
  const keepAt = (r: ItemRow) => {
    const now = Date.now(), up = Date.parse(r.updated_at ?? "") || 0;
    return new Date(Math.max(now, up + 1)).toISOString();
  };
  const title = rows.length === 1 ? `Row #${rows[0].n} was updated` : `${rows.length} rows you edited were updated`;
  return (
    <Modal open={open && rows.length > 0} onClose={onClose} title={title} labelId="revTitle" className="diffpanel" center>
      <p>The shared {list.name} list changed after you edited {rows.length === 1 ? "this row" : "these rows"}. You're still seeing your version. Compare them and pick one.</p>
      {readOnly && <p className="dwarn">This save file is view only, so only its owner or an editor can choose.</p>}
      <div className="dlist">
        {rows.map(r => (
          <section key={r.n} className="ditem">
            <RowHead r={r} />
            <Diff list={list} r={r} o={st.O[r.n]} left={`Updated ${when(r.updated_at)}`} right="Your version" />
            {!readOnly && <div className="dactions row">
              <button className="editbtn" onClick={() => onResolve([], [{ n: r.n, at: keepAt(r) }])}>Keep mine</button>
              <button className="primary sm" onClick={() => onResolve([r.n], [])}>Use the update</button>
            </div>}
          </section>
        ))}
      </div>
      {!readOnly && rows.length > 1 && <div className="dactions">
        <button className="editbtn" onClick={() => onResolve([], rows.map(r => ({ n: r.n, at: keepAt(r) })))}>Keep all mine</button>
        <button className="primary" onClick={() => onResolve(rows.map(r => r.n), [])}>Use all updates</button>
      </div>}
    </Modal>
  );
}
