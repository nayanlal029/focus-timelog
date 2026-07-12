import type { Category, CategoryType } from "./types";

// Parses a CSV file matching the FocusLog export format:
// Columns (case-insensitive): Date, Start Time, End Time, Duration (minutes)?,
// Category, Type?, Note?, Link?
// Date format: YYYY-MM-DD. Times: HH:MM or HH:MM:SS (24h).
// Returns rows ready to feed addManyPastBlocks + names of unmatched categories.

export interface CsvRow {
  categoryId: string; // may be "__pending__<name>" when category does not yet exist
  categoryName: string;
  type: CategoryType;
  start: number;
  end: number;
  note?: string;
  link?: string;
}

export interface CsvPlan {
  rows: CsvRow[];
  unmatchedNames: { name: string; type: CategoryType }[];
  skipped: number;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseDateTime(date: string, time: string): number | null {
  const d = date.trim();
  const t = (time || "00:00").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const tt = /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t;
  if (!/^\d{2}:\d{2}:\d{2}$/.test(tt)) return null;
  const ms = new Date(`${d}T${tt}`).getTime();
  return isFinite(ms) ? ms : null;
}

function normalizeType(s: string | undefined): CategoryType | null {
  if (!s) return null;
  const v = s.trim().toLowerCase();
  if (v === "focus") return "focus";
  if (v === "distraction") return "distraction";
  if (v === "neutral") return "neutral";
  return null;
}

export function buildCsvPlan(text: string, categories: Category[]): CsvPlan {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], unmatchedNames: [], skipped: 0 };

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => headers.indexOf(name.toLowerCase());
  const iDate = idx("date");
  const iStart = idx("start time");
  const iEnd = idx("end time");
  const iCat = idx("category");
  const iType = idx("type");
  const iNote = idx("note");
  const iLink = idx("link");

  if (iDate < 0 || iStart < 0 || iEnd < 0 || iCat < 0) {
    throw new Error("CSV must include Date, Start Time, End Time, Category columns.");
  }

  const catByLower = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const unmatched = new Map<string, CategoryType>();
  const rows: CsvRow[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const date = cols[iDate] ?? "";
    const start = parseDateTime(date, cols[iStart] ?? "");
    const end = parseDateTime(date, cols[iEnd] ?? "");
    const name = (cols[iCat] ?? "").trim();
    if (!start || !end || end <= start || !name) { skipped++; continue; }

    const existing = catByLower.get(name.toLowerCase());
    const explicitType = iType >= 0 ? normalizeType(cols[iType]) : null;
    const type: CategoryType = existing?.type ?? explicitType ?? "neutral";
    const categoryId = existing?.id ?? `__pending__${name}`;
    if (!existing && !unmatched.has(name)) unmatched.set(name, type);

    rows.push({
      categoryId,
      categoryName: existing?.name ?? name,
      type,
      start,
      end,
      note: iNote >= 0 ? (cols[iNote] || undefined) : undefined,
      link: iLink >= 0 ? (cols[iLink] || undefined) : undefined,
    });
  }

  return {
    rows,
    unmatchedNames: Array.from(unmatched.entries()).map(([name, type]) => ({ name, type })),
    skipped,
  };
}
