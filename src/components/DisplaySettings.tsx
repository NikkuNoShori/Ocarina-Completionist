import type { Settings } from "../lib/types";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../hooks/useSettings";

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
        <span>Zoom</span>
        <ZoomControl settings={settings} setSettings={setSettings} />
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

/** − 100% + : scales the whole page in 5% steps between 75% and 125%. Tap the number to go back to 100%. */
export function ZoomControl({ settings, setSettings }: { settings: Settings; setSettings: (s: Settings) => void }) {
  const z = settings.zoom;
  const to = (n: number) => setSettings({ ...settings, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n)) });
  return (
    <div className="zoomc" role="group" aria-label="Zoom">
      <button aria-label="Zoom out" disabled={z <= ZOOM_MIN} onClick={() => to(z - ZOOM_STEP)}>−</button>
      <button className="zval" aria-label={`Zoom ${z}%. Reset to 100%`} title="Reset to 100%" onClick={() => to(100)}>{z}%</button>
      <button aria-label="Zoom in" disabled={z >= ZOOM_MAX} onClick={() => to(z + ZOOM_STEP)}>+</button>
    </div>
  );
}
