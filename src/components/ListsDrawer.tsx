import { useEffect, useRef, type ReactNode } from "react";
import type { ChecklistList, Progress } from "../lib/types";
import { PanelIcon } from "./ui";

/**
 * The lists. Desktop: a panel docked on the left, with the account card (`account`) at the bottom.
 * Phones and tablets (`sheet`): a bottom sheet opened from the title in the top bar.
 */
export function ListsDrawer({ lists, progress, overallPct, curId, editing, onPick, onClose, account, sheet }: {
  lists: ChecklistList[]; progress: Progress; overallPct: number; curId: string; editing: boolean; onPick: () => void; onClose: () => void;
  account?: ReactNode; sheet?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!sheet) return;
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('[aria-current="page"], a')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    document.addEventListener("keydown", onKey);
    // Keep the page behind from scrolling while the sheet is up
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; opener?.focus?.(); };
  }, [sheet]);

  const nav = (
    <nav id="tabs" aria-disabled={editing}>
      {(() => {
        const g = lists.reduce((n, L) => n + (progress[L.id]?.got.size ?? 0), 0), t = lists.reduce((n, L) => n + L.rows.length, 0);
        return (
          <a href="#all" className="tall" aria-current={curId === "all" ? "page" : undefined} onClick={onPick}>
            <span className="nm">All checklists</span>
            <span className="tc">{g}/{t}</span>
            <span className="bar2"><i style={{ width: `${t ? (g / t) * 100 : 0}%` }} /></span>
          </a>
        );
      })()}
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
  );

  if (sheet) return (
    <div className="lscrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={ref} className="drawer lsheet" id="drawer" role="dialog" aria-modal="true" aria-labelledby="lsheetTitle">
        <span className="grab" aria-hidden="true" />
        <div className="lshead">
          <h2 id="lsheetTitle">Checklists <span className="dpct">{overallPct}% overall</span></h2>
          <button className="close" onClick={onClose}>Close</button>
        </div>
        {editing && <p className="dnote">Finish or cancel editing to switch lists.</p>}
        {nav}
      </aside>
    </div>
  );

  return (
    <aside className="drawer" id="drawer" aria-label="Checklists">
      <div className="dhead">
        <h2>Checklists <span className="dpct" title="Overall completion">{overallPct}%</span></h2>
        <button className="ptoggle" onClick={onClose} aria-label="Close the lists panel" title="Close the lists panel"><PanelIcon /></button>
      </div>
      {nav}
      {editing && <p className="dnote">Finish or cancel editing to switch lists.</p>}
      {account && <div className="dacct">{account}</div>}
    </aside>
  );
}
