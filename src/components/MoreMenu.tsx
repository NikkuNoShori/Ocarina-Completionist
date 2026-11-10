import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The ⋮ menu for the checklist (hide collected, edit, downloads, sort).
 * Display settings live in the account menu instead.
 */
export function MoreMenu({ items }: { items: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    // Outside the menu closes it. On phones the dimmed backdrop belongs to the wrapper itself, so that closes it too.
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node) || e.target === wrap.current) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("click", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const close = () => setOpen(false);

  return (
    <div className="kebab" ref={wrap}>
      <button className="kbtn" ref={btn} aria-haspopup="menu" aria-expanded={open} aria-label="List options" onClick={() => setOpen(o => !o)}>⋮</button>
      {open && <div className="kmenu" role="menu">{items(close)}</div>}
    </div>
  );
}
