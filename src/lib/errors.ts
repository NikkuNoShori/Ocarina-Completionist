import { sb } from "./supabase";

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "dev";

interface ErrShape { message: string; code?: string; status?: number; name?: string }

/** Pull a message and code out of anything that was thrown or returned as an error. */
export function errInfo(e: unknown): ErrShape {
  if (!e) return { message: "Unknown error" };
  if (typeof e === "string") return { message: e };
  const o = e as Record<string, unknown>;
  return {
    message: String(o.message ?? o.error_description ?? o.error ?? "Unknown error"),
    code: o.code != null ? String(o.code) : undefined,
    status: typeof o.status === "number" ? o.status : undefined,
    name: typeof o.name === "string" ? o.name : undefined,
  };
}

const isNetwork = (i: ErrShape) => /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(i.message);

/** Errors caused by what the person typed or did, not by a bug. These aren't logged. */
export function isExpected(e: unknown): boolean {
  const i = errInfo(e);
  return isNetwork(i)
    || /invalid login credentials|email not confirmed|user already registered|password should|rate limit|for security purposes/i.test(i.message)
    || i.code === "23505";
}

/** A message a person can act on. */
export function friendly(e: unknown, fallback?: string): string {
  const i = errInfo(e);
  if (isNetwork(i)) return "Can't reach the server. Check your connection and try again.";
  if (/invalid login credentials/i.test(i.message)) return "Wrong email or password.";
  if (/email not confirmed/i.test(i.message)) return "Confirm your email first. Check your inbox for the link.";
  if (/user already registered/i.test(i.message)) return "There's already an account with that email. Sign in instead.";
  if (/rate limit|for security purposes/i.test(i.message)) return "Too many tries. Wait a minute and try again.";
  if (/password should/i.test(i.message)) return i.message;
  if (/jwt expired|invalid jwt|refresh token/i.test(i.message) || i.code === "PGRST301") return "Your session expired. Sign in again.";
  if (i.code === "42501" || /row-level security|permission denied/i.test(i.message)) return "You don't have permission to do that. The owner may have changed your access.";
  if (i.code === "23505") return "That already exists.";
  return fallback ? `${fallback} (${i.message})` : i.message;
}

// Keep the log useful: skip repeats of the same error within a minute, and cap each page load.
const seen = new Map<string, number>();
let sent = 0;

/** Log an error to the console and to the client_errors table (admins can read it in the Account panel). */
export function reportError(context: string, e: unknown, detail?: Record<string, unknown>) {
  const i = errInfo(e);
  console.error(`[${context}]`, e, detail ?? "");
  const key = context + "|" + i.message;
  const now = Date.now();
  if ((seen.get(key) ?? 0) > now - 60_000 || sent >= 25) return;
  seen.set(key, now);
  sent++;
  const stack = e instanceof Error && e.stack ? e.stack.slice(0, 3000) : undefined;
  void sb.from("client_errors").insert({
    context: context.slice(0, 120),
    message: i.message.slice(0, 2000),
    code: i.code?.slice(0, 60) ?? (i.status ? String(i.status) : null),
    detail: { ...(detail ?? {}), ...(stack ? { stack } : {}), ...(i.name ? { name: i.name } : {}) },
    url: location.href.slice(0, 500),
    user_agent: navigator.userAgent.slice(0, 400),
    app_version: APP_VERSION,
  }).then(({ error }) => { if (error) console.warn("Couldn't log error", error.message); });
}
