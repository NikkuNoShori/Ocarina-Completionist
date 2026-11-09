import { eff } from "./rows";
import type { ChecklistList, Progress } from "./types";

/** One tab (or a CSV file) after reading, with the rows it marks as collected. */
export interface ParsedSheet {
  name: string;
  rows: number;          // data rows found under the header
  collected: { n: number | null; loc: string }[];
  error?: string;        // why this tab can't be imported
}

export const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const truthy = (v: unknown) => v === true || v === 1 || /^(true|yes|y|x|1|✓|✔|done|got)$/i.test(String(v ?? "").trim());

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim()));
}

/** Find the header row (it may sit under a title row) and pull out the collected rows. */
function parseGrid(name: string, grid: unknown[][]): ParsedSheet {
  const isHead = (r: unknown[]) => r.some(c => norm(c) === "collected" || norm(c) === "got" || norm(c) === "done");
  const h = grid.slice(0, 10).findIndex(isHead);
  if (h < 0) return { name, rows: 0, collected: [], error: "No Collected column" };
  const head = grid[h].map(norm);
  const iC = head.findIndex(c => c === "collected" || c === "got" || c === "done");
  const iHash = grid[h].findIndex(c => ["#", "no", "no.", "number", "n"].includes(String(c ?? "").trim().toLowerCase()));
  const iL = head.findIndex(c => c === "location" || c === "where");
  if (iHash < 0 && iL < 0) return { name, rows: 0, collected: [], error: "Needs a # or Location column" };
  const data = grid.slice(h + 1).filter(r => r.some(c => String(c ?? "").trim()));
  const collected = data.filter(r => truthy(r[iC])).map(r => {
    const n = iHash >= 0 ? parseInt(String(r[iHash] ?? ""), 10) : NaN;
    return { n: Number.isFinite(n) ? n : null, loc: iL >= 0 ? String(r[iL] ?? "") : "" };
  });
  return { name, rows: data.length, collected };
}

/** Read a .csv or .xlsx file into tabs. The Excel reader is only downloaded when needed. */
export async function readSpreadsheet(file: File): Promise<ParsedSheet[]> {
  const base = file.name.replace(/\.[^.]+$/, "");
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return [parseGrid(base, parseCsv(await file.text()))];
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Use a .xlsx or .csv file. (Older .xls files: open them and save as .xlsx first.)");
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  return sheets.map(s => parseGrid(s.sheet, s.data as unknown[][]));
}

/** Best guess for which list a tab belongs to. Null means skip. */
export function guessList(sheet: ParsedSheet, lists: ChecklistList[], index: number): string | null {
  const s = norm(sheet.name);
  const exact = lists.find(L => norm(L.name) === s || norm(L.id) === s);
  if (exact) return exact.id;
  // An untitled first tab with ~100 rows is the original Skulltula sheet
  if ((/^(untitled|sheet ?1)$/.test(s) || index === 0) && sheet.rows >= 90) return lists.find(L => L.id === "skulltulas")?.id ?? null;
  const combined = /&| and |,/.test(sheet.name.toLowerCase()) || lists.filter(L => s.includes(norm(L.name))).length > 1;
  const loose = lists.find(L => s.includes(norm(L.name)) || norm(L.name).includes(s));
  if (loose && !combined) return loose.id;
  // A tab that mixes several lists (e.g. an old "Bottles & Gear" tab): match each row by its location
  return sheet.collected.some(c => c.loc) ? ANY_LIST : null;
}

/**
 * Turn a tab's collected rows into item numbers for a list.
 * Location text is matched first, so a tab from before a list was split still lines up.
 * `#` is used when the row has no location, or when the tab is clearly this list (its name matched),
 * which covers locations you've edited since.
 */
export function matchRows(sheet: ParsedSheet, list: ChecklistList, trustNumbers: boolean): { ns: number[]; unmatched: number } {
  const byLoc = new Map(list.rows.map(r => [norm(r.location), r.n]));
  const valid = new Set(list.rows.map(r => r.n));
  const ns = new Set<number>(); let unmatched = 0;
  for (const c of sheet.collected) {
    const viaLoc = c.loc ? findLoc(byLoc, c.loc) : undefined;
    const viaNum = c.n != null && valid.has(c.n) && (trustNumbers || !c.loc) ? c.n : undefined;
    const n = viaLoc ?? viaNum;
    if (n != null) ns.add(n); else unmatched++;
  }
  return { ns: [...ns], unmatched };
}

/** Exact location match, or the same text without a short "Bottle:" / "Song:" style prefix. */
function findLoc(byLoc: Map<string, number>, loc: string): number | undefined {
  return byLoc.get(norm(loc)) ?? byLoc.get(norm(loc.replace(/^[^:]{1,20}:\s*/, "")));
}

/** Pseudo-list id for "match each row against every list by its location". */
export const ANY_LIST = "*";

/** Match a mixed tab (e.g. an old "Bottles & Gear" tab) row by row against every list, by location only. */
export function matchAnyList(sheet: ParsedSheet, lists: ChecklistList[]): { byList: Map<string, number[]>; unmatched: number } {
  const maps = lists.map(L => ({ id: L.id, byLoc: new Map(L.rows.map(r => [norm(r.location), r.n])) }));
  const byList = new Map<string, number[]>(); let unmatched = 0;
  for (const c of sheet.collected) {
    const hit = c.loc ? maps.map(m => ({ id: m.id, n: findLoc(m.byLoc, c.loc) })).find(x => x.n != null) : undefined;
    if (hit) (byList.get(hit.id) ?? byList.set(hit.id, []).get(hit.id)!).push(hit.n!); else unmatched++;
  }
  return { byList, unmatched };
}

/** True when the tab's name clearly names this list. */
export const namesMatch = (sheet: ParsedSheet, list: ChecklistList, index: number) =>
  norm(sheet.name) === norm(list.name) || norm(sheet.name) === norm(list.id)
  || (list.id === "skulltulas" && (index === 0 || /^(untitled|sheet ?1)$/.test(norm(sheet.name))) && sheet.rows >= 90);

const HEAD = ["#", "Area", "Location", "Map Level", "Link", "Adult first", "Time", "Notes", "Collected"];

/** One list as rows (shared by the CSV and Excel downloads). */
export function listRows(list: ChecklistList, progress: Progress): (string | number | boolean)[][] {
  const st = progress[list.id] ?? { got: new Set<number>(), O: {} };
  return list.rows.map(r => eff(r, st)).map(r => [r.n, r.a, r.l, r.lv === "?" ? "" : r.lv, r.age, r.af, r.time, r.note, st.got.has(r.n)]);
}

export function downloadCsv(list: ChecklistList, progress: Progress) {
  const cell = (v: unknown) => { const s = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const text = [HEAD, ...listRows(list, progress)].map(r => r.map(cell).join(",")).join("\n");
  save(new Blob([text], { type: "text/csv" }), `${list.name}.csv`);
}

/** Every list in one workbook, a tab per list. */
export async function downloadXlsx(lists: ChecklistList[], progress: Progress, fileName: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const bold = { fontWeight: "bold" as const };
  const sheets = lists.map(L => ({
    sheet: L.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31),
    stickyRowsCount: 1,
    columns: [{ width: 5 }, { width: 24 }, { width: 60 }, { width: 10 }, { width: 8 }, { width: 11 }, { width: 8 }, { width: 50 }, { width: 11 }],
    data: [HEAD.map(h => ({ value: h, ...bold })), ...listRows(L, progress)],
  }));
  save(await writeXlsxFile(sheets).toBlob(), fileName);
}

function save(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
