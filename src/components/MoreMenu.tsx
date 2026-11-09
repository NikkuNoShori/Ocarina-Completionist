import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Settings } from "../lib/types";

export const THEMES: [string, string][] = [
  ["kokiri", "Kokiri Green"], ["zora", "Zora Blue"], ["golden", "Triforce Gold"],
  ["royal", "Hylian Royal"], ["hyrule", "Hyrule Night"], ["sheikah", "Sheikah Slate"],
];

/**
 * The ⋮ menu. Display settings (theme, light/dark, spacing) are always in it, on every page.
 * Pages can add their own items above them (the checklist adds hide collected, edit, downloads, sort).
 */
export function MoreMenu({ settings, setSettings, items }: {
  settings: Settings; setSettings: (s: Settings) => void;
  items?: (close: () => void) => ReactNode;
}) {
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
  const set = (k: keyof Settings, v: string) => setSettings({ ...settings, [k]: v } as Settings);
  const close = () => setOpen(false);
  const extra = items?.(close);

  return (
    <div className="kebab" ref={wrap}>
      <button className="kbtn" ref={btn} aria-haspopup="menu" aria-expanded={open} aria-label="More options" onClick={() => setOpen(o => !o)}>⋮</button>
      {open && (
        <div className="kmenu" role="menu">
          {extra}
          <div className={extra ? "ksec" : "ksec first"} role="group" aria-label="Display">
            <div className="klabel">Display</div>
            <label className="kfield">
              <span>Theme</span>
              <span className="kselwrap">
                <span className="sw mini" data-sw={settings.theme} aria-hidden="true"><i /><i /><i /></span>
                <select className="sel ksel" value={settings.theme} onChange={e => set("theme", e.target.value)}>
                  {THEMES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </span>
            </label>
            <div className="kfield">
              <span>Mode</span>
              <div className="kseg">
                {(["light", "dark"] as const).map(m => <button key={m} className="kitem kpill" aria-pressed={settings.mode === m} onClick={() => set("mode", m)}>{m === "light" ? "Light" : "Dark"}</button>)}
              </div>
            </div>
            <div className="kfield">
              <span>Spacing</span>
              <div className="kseg">
                {(["comfortable", "compact"] as const).map(d => <button key={d} className="kitem kpill" aria-pressed={settings.density === d} onClick={() => set("density", d)}>{d === "comfortable" ? "Comfortable" : "Compact"}</button>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
