import { useEffect, useRef, useState, type ReactNode } from "react";

export function PanelIcon() {
  return (
    <svg className="pico" viewBox="0 0 20 16" aria-hidden="true">
      <rect x="1" y="1" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect className="pfill" x="1.8" y="1.8" width="6.2" height="12.4" rx="1.6" />
      <line x1="8" y1="1.5" x2="8" y2="14.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Dialog over a dimmed backdrop. Esc or a click outside closes it. */
export function Modal({ open, onClose, title, labelId, className, center, children }: {
  open: boolean; onClose: () => void; title: string; labelId: string; className?: string; center?: boolean; children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={"scrim" + (center ? " acctscrim" : "")} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"panel " + (className ?? "")} role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <div className="phead"><h2 id={labelId}>{title}</h2><button className="close" ref={closeRef} onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

/** A button that needs a second tap within 4 seconds to run. */
export function ConfirmButton({ label, confirmLabel, onConfirm, className }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button className={className ?? "linkbtn danger"} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>{armed ? confirmLabel : label}</button>;
}
