import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Pick one or more areas. Options are alphabetical, each with its collected/total count.
 * Desktop: a dropdown under the button. Phones: a sheet from the bottom of the screen.
 */
export function AreaPicker({ value, onChange, options, total }: {
  value: string[]; onChange: (v: string[]) => void;
  options: { name: string; count: string }[]; total: string;
}) {
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState("");
  const wrap = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // Picked areas this list doesn't have still show (with 0) so they can be unticked
  const opts = useMemo(() => {
    const known = new Set(options.map(o => o.name));
    return [...options, ...value.filter(a => !known.has(a)).map(name => ({ name, count: "0" }))]
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [options, value]);
  const shown = find ? opts.filter(o => o.name.toLowerCase().includes(find.toLowerCase())) : opts;

  useEffect(() => {
    if (!open) { setFind(""); return; }
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node) || e.target === wrap.current) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const toggle = (a: string) => onChange(value.includes(a) ? value.filter(x => x !== a) : [...value, a].sort((x, y) => x.localeCompare(y)));
  const label = value.length === 0 ? `All areas (${total})` : value.length === 1 ? value[0] : `${value.length} areas`;

  return (
    <div className={"apick" + (open ? " open" : "")} ref={wrap}>
      <button ref={btn} type="button" className="sel apbtn" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        title={value.length > 1 ? value.join(", ") : undefined} onClick={() => setOpen(o => !o)}>
        <span className="aplabel">{label}</span>
      </button>
      {open && (
        <div className="apmenu" role="dialog" aria-label="Choose areas">
          <div className="aphead">
            <input className="sel apfind" type="search" placeholder="Find an area…" aria-label="Find an area" autoComplete="off"
              value={find} onChange={e => setFind(e.target.value)} />
            <button type="button" className="linkbtn" disabled={!value.length} onClick={() => onChange([])}>Clear</button>
          </div>
          <div className="aplist" id={listId} role="listbox" aria-multiselectable="true">
            {shown.map(o => (
              <label key={o.name} className="apitem" role="option" aria-selected={value.includes(o.name)}>
                <input type="checkbox" checked={value.includes(o.name)} onChange={() => toggle(o.name)} />
                <span className="apname">{o.name}</span><span className="apcount">{o.count}</span>
              </label>
            ))}
            {!shown.length && <p className="apnone">No area matches “{find}”.</p>}
          </div>
          <button type="button" className="apdone" onClick={() => { setOpen(false); btn.current?.focus(); }}>
            {value.length ? `Show ${value.length === 1 ? value[0] : `${value.length} areas`}` : "Show all areas"}
          </button>
        </div>
      )}
    </div>
  );
}
