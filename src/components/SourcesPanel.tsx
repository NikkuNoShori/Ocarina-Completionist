import { useEffect, useState } from "react";
import type { ChecklistList, Source, SourceNote } from "../lib/types";
import { Modal } from "./ui";

export function SourcesPanel({ open, onClose, lists, sources, notes, curId }: {
  open: boolean; onClose: () => void; lists: ChecklistList[]; sources: Source[]; notes: SourceNote[]; curId: string;
}) {
  const [f, setF] = useState(curId);
  useEffect(() => { if (open) setF(curId); }, [open, curId]);
  const name = (id: string) => lists.find(L => L.id === id)?.name ?? "";

  const sites: { site: string; home: string; pages: Source[] }[] = [];
  sources.forEach(s => { let g = sites.find(x => x.site === s.site); if (!g) sites.push(g = { site: s.site, home: s.site_url, pages: [] }); g.pages.push(s); });
  const shownNotes = notes.filter(x => f === "all" || !x.list_id || x.list_id === f);

  return (
    <Modal open={open} onClose={onClose} title="Sources" labelId="srcTitle">
      <label className="srcfilter">Show sources for{" "}
        <select className="sel" value={f} onChange={e => setF(e.target.value)}>
          <option value="all">All lists</option>
          {lists.map(L => <option key={L.id} value={L.id}>{L.name}</option>)}
        </select>
      </label>
      <div className="srcacc">
        {sites.map(S => {
          const pg = S.pages.filter(p => f === "all" || p.list_ids.includes(f) || p.list_ids.includes("all"));
          if (!pg.length) return null;
          return (
            <details className="acc" key={S.site}>
              <summary><span className="anm">{S.site}</span><span className="acnt">{pg.length} page{pg.length > 1 ? "s" : ""}</span></summary>
              <ul className="apages">
                {pg.map(p => (
                  <li key={p.id}>
                    <a href={p.url} target="_blank" rel="noopener">{p.title} ↗</a>
                    <span className="why">{p.used_for}</span>
                    {f === "all" && !p.list_ids.includes("all") && <span className="chips">{p.list_ids.map(id => <span className="chip" key={id}>{name(id)}</span>)}</span>}
                  </li>
                ))}
                <li className="home"><a href={S.home} target="_blank" rel="noopener">Visit {S.site} ↗</a></li>
              </ul>
            </details>
          );
        })}
      </div>
      <details className="acc notesacc">
        <summary><span className="anm">Notes</span><span className="acnt">{shownNotes.length}</span></summary>
        <ul className="srcnotes">
          {shownNotes.map(x => <li key={x.id}>{x.list_id && f === "all" && <b>{name(x.list_id)}: </b>}{x.note}</li>)}
        </ul>
      </details>
    </Modal>
  );
}
