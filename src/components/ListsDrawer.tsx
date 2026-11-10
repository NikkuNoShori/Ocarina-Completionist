import type { ReactNode } from "react";
import type { ChecklistList, Progress } from "../lib/types";
import { PanelIcon } from "./ui";

/** The lists panel. On desktop the account card (passed in as `account`) sits at the bottom. */
export function ListsDrawer({ lists, progress, overallPct, curId, editing, onPick, onClose, account }: {
  lists: ChecklistList[]; progress: Progress; overallPct: number; curId: string; editing: boolean; onPick: () => void; onClose: () => void;
  account?: ReactNode;
}) {
  return (
    <aside className="drawer" id="drawer" aria-label="Checklists">
      <div className="dhead">
        <h2>Checklists <span className="dpct" title="Overall completion">{overallPct}%</span></h2>
        <button className="ptoggle" onClick={onClose} aria-label="Close the lists panel" title="Close the lists panel"><PanelIcon /></button>
      </div>
      <nav id="tabs" aria-disabled={editing}>
        {lists.map(L => {
          const g = progress[L.id]?.got.size ?? 0, t = L.rows.length;
          return (
            <a key={L.id} href={"#" + L.id} aria-current={L.id === curId ? "page" : undefined} onClick={onPick}>
              <span className="nm">{L.name}</span>
              <span className="tc">{g}/{t}</span>
              <span className="bar2"><i style={{ width: `${t ? (g / t) * 100 : 0}%` }} /></span>
            </a>
          );
        })}
      </nav>
      {editing && <p className="dnote">Finish or cancel editing to switch lists.</p>}
      {account && <div className="dacct">{account}</div>}
    </aside>
  );
}
