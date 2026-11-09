import type { ChecklistList, Progress } from "../lib/types";
import { PanelIcon } from "./ui";

export function ListsDrawer({ lists, progress, curId, editing, onPick, onClose }: {
  lists: ChecklistList[]; progress: Progress; curId: string; editing: boolean; onPick: () => void; onClose: () => void;
}) {
  return (
    <aside className="drawer" id="drawer" aria-label="Checklists">
      <div className="dhead">
        <h2>Checklists</h2>
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
    </aside>
  );
}
