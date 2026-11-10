import type { Settings } from "../lib/types";

export const THEMES: [string, string][] = [
  ["hyrule", "Hyrule Night"], ["kokiri", "Kokiri Green"], ["zora", "Zora Blue"],
  ["golden", "Triforce Gold"], ["royal", "Hylian Royal"], ["sheikah", "Sheikah Slate"],
];

/** Theme, light/dark and spacing. Lives in the account menu; works signed in or not. */
export function DisplaySettings({ settings, setSettings }: { settings: Settings; setSettings: (s: Settings) => void }) {
  const set = (k: keyof Settings, v: string) => setSettings({ ...settings, [k]: v } as Settings);
  return (
    <div className="dset">
      <label className="drow">
        <span>Theme</span>
        <span className="kselwrap">
          <span className="sw mini" data-sw={settings.theme} aria-hidden="true"><i /><i /><i /></span>
          <select className="sel ksel" value={settings.theme} onChange={e => set("theme", e.target.value)}>
            {THEMES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </span>
      </label>
      <div className="drow">
        <span>Mode</span>
        <div className="dseg" role="group" aria-label="Mode">
          {(["light", "dark"] as const).map(m => <button key={m} aria-pressed={settings.mode === m} onClick={() => set("mode", m)}>{m === "light" ? "Light" : "Dark"}</button>)}
        </div>
      </div>
      <div className="drow">
        <span>Spacing</span>
        <div className="dseg" role="group" aria-label="Spacing">
          {(["comfortable", "compact"] as const).map(d => <button key={d} aria-pressed={settings.density === d} onClick={() => set("density", d)}>{d === "comfortable" ? "Comfortable" : "Compact"}</button>)}
        </div>
      </div>
    </div>
  );
}
