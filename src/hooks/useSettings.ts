import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import { reportError } from "../lib/errors";
import { ls } from "../lib/storage";
import type { Settings } from "../lib/types";

/** What a first-time visitor sees: Hyrule Night, dark. */
export const DEFAULT_SETTINGS: Settings = { theme: "hyrule", mode: "dark", density: "comfortable", zoom: 100 };

/**
 * Theme, light/dark and spacing: kept in this browser and, when signed in, on the account.
 * Sync failures are logged but not shown: the settings still work in this browser.
 */
export const ZOOM_MIN = 75, ZOOM_MAX = 125, ZOOM_STEP = 5;
export const clampZoom = (z: unknown) => { const n = Math.round(Number(z) / ZOOM_STEP) * ZOOM_STEP; return Number.isFinite(n) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n)) : 100; };

export function useSettings(user: User | null, activeSaveId: string | null) {
  const [settings, setSettings] = useState<Settings>({
    theme: ls.get("oot-skin", DEFAULT_SETTINGS.theme),
    mode: ls.get("oot-mode", DEFAULT_SETTINGS.mode),
    density: ls.get("oot-density", "comfortable"),
    zoom: clampZoom(ls.get("oot-zoom", 100)),
  });
  const [syncedUser, setSyncedUser] = useState<string | null>(null);
  const loading = useRef<string | null>(null);

  // Apply to the page
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.skin = settings.theme; root.dataset.theme = settings.mode; root.dataset.density = settings.density;
    ls.set("oot-skin", settings.theme); ls.set("oot-mode", settings.mode); ls.set("oot-density", settings.density);
    // Zoom scales the whole page; 100% clears it so the browser's own zoom is untouched
    root.style.zoom = settings.zoom === 100 ? "" : String(settings.zoom / 100); ls.set("oot-zoom", settings.zoom);
    // Fonts load per theme (see index.html); the browser bar matches the page background on phones
    (window as unknown as { ootFonts?: (s: string) => void }).ootFonts?.(settings.theme);
    const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [settings]);

  // Load the account's saved settings once per sign-in, before anything is written back
  useEffect(() => {
    if (!user) { setSyncedUser(null); loading.current = null; return; }
    if (loading.current === user.id) return;
    loading.current = user.id;
    sb.from("user_settings").select("theme,mode,density,zoom").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (error) reportError("load settings", error);
      else if (data) setSettings({ theme: data.theme, mode: data.mode, density: data.density, zoom: clampZoom(data.zoom) });
      setSyncedUser(user.id);
    });
  }, [user]);

  // Save to the account (debounced)
  useEffect(() => {
    if (!user || syncedUser !== user.id) return;
    const t = setTimeout(() => {
      sb.from("user_settings")
        .upsert({ user_id: user.id, ...settings, active_save_id: activeSaveId, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) reportError("save settings", error); });
    }, 500);
    return () => clearTimeout(t);
  }, [user, syncedUser, settings, activeSaveId]);

  return [settings, setSettings] as const;
}
