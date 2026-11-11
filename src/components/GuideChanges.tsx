import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { reportError } from "../lib/errors";
import { Diff, RowHead } from "./RowUpdates";
import type { ChecklistList, ItemRow, RowEdit } from "../lib/types";

/** One published change to one row, as kept in the publish log. */
interface Change { id: number; at: string; list_id: string; n: number; before: ItemRow; changes: RowEdit }

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });

/** Every change published to the shared guide, newest first, each with Before and After. */
export function GuideChanges({ lists }: { lists: ChecklistList[] }) {
  const [rows, setRows] = useState<Change[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    sb.rpc("guide_changes", { p_limit: 500 }).then(({ data, error }) => {
      if (error) { reportError("load guide changes", error); setFailed(true); return; }
      setRows((data ?? []) as Change[]);
    });
  }, []);

  if (failed) return <p className="sub">We couldn't load the updates right now. Please try again in a moment.</p>;
  if (!rows) return <p className="sub">Loading updates…</p>;
  if (!rows.length) return <p className="sub">No updates yet. When we add new information to the guide, it'll show up here.</p>;

  // Group by day, then by list within the day
  const byDay = new Map<string, Change[]>();
  rows.forEach(c => { const d = day(c.at); byDay.set(d, [...(byDay.get(d) ?? []), c]); });
  const listOf = (id: string) => lists.find(L => L.id === id);

  return (
    <div className="changes">
      <p className="sub">Everything we've updated in the guide, newest first. If you changed a spot yourself, your checklist keeps your version until you approve the update.</p>
      {[...byDay].map(([d, cs]) => (
        <section key={d} className="cday">
          <h2>{d}</h2>
          {[...new Set(cs.map(c => c.list_id))].map(lid => {
            const L = listOf(lid);
            if (!L) return null;
            return (
              <div key={lid} className="clist">
                <h3><a href={`#${lid}`}>{L.name}</a></h3>
                <div className="dlist">
                  {cs.filter(c => c.list_id === lid).map(c => (
                    <section key={c.id} className="ditem">
                      <RowHead r={c.before} />
                      <Diff list={L} r={c.before} o={c.changes} left="Before" right="After" />
                    </section>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
