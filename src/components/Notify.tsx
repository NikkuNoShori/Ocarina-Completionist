import { Component, createContext, useCallback, useContext, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { friendly, isExpected, reportError } from "../lib/errors";

type Kind = "ok" | "info" | "err";
export interface ToastAction { label: string; run: () => void }
interface ToastItem { id: number; kind: Kind; text: string; action?: ToastAction }

export interface Notify {
  ok: (text: string) => void;
  info: (text: string, action?: ToastAction) => void;
  /** Show an error to the person and log it. `fallback` describes what failed, e.g. "Couldn't save". */
  error: (context: string, err: unknown, fallback?: string) => void;
}

const Ctx = createContext<Notify | null>(null);

/** The one place messages appear: a stack of toasts at the bottom of the screen. */
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  const push = useCallback((kind: Kind, text: string, action?: ToastAction) => {
    setToasts(t => {
      if (t.some(x => x.text === text)) return t; // don't stack duplicates
      const id = nextId.current++;
      // Notices with a button stay longer so there's time to use it
      setTimeout(() => dismiss(id), action ? 15000 : kind === "err" ? 9000 : 6000);
      return [...t.slice(-3), { id, kind, text, action }];
    });
  }, [dismiss]);

  const api = useMemo<Notify>(() => ({
    ok: text => push("ok", text),
    info: (text, action) => push("info", text, action),
    error: (context, err, fallback) => {
      if (!isExpected(err)) reportError(context, err);
      push("err", friendly(err, fallback));
    },
  }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map(t => (
          <div key={t.id} className={"toast " + t.kind} role={t.kind === "err" ? "alert" : "status"}>
            <span>{t.text}</span>
            {t.action && <button className="taction" onClick={() => { dismiss(t.id); t.action!.run(); }}>{t.action.label}</button>}
            <button className="tclose" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useNotify(): Notify {
  const n = useContext(Ctx);
  if (!n) throw new Error("useNotify must be used inside NotifyProvider");
  return n;
}

/** Catches crashes while rendering, logs them, and shows a way back instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError("render", error, { componentStack: (info.componentStack ?? "").slice(0, 3000) });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="wrap crash">
        <h1>Something went wrong</h1>
        <p className="sub">The page hit an unexpected error. It's been logged. Your saved progress is safe.</p>
        <button className="primary" onClick={() => location.reload()}>Reload the page</button>
      </div>
    );
  }
}
