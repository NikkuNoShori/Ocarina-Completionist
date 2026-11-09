import type { Completion } from "../lib/progress";

/** A completion ring with the overall %, and a compact bar per list. */
export function ProgressSummary({ c, compact }: { c: Completion; compact?: boolean }) {
  return (
    <div className={"psum" + (compact ? " compact" : "")}>
      <div className="pring" style={{ ["--p" as string]: c.pct }} role="img" aria-label={`${c.pct}% complete`}>
        <div><b>{c.pct}%</b><small>{c.done} of {c.total}</small></div>
      </div>
      <ul className="plists">
        {c.perList.map(l => (
          <li key={l.id}>
            <span className="pl-name">{l.name}</span>
            <span className="pl-num">{l.done}/{l.total}</span>
            <span className="pl-bar"><i style={{ width: `${l.pct}%` }} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
