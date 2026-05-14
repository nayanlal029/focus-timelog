import type { Category, CategoryType } from "./types";

interface ChromeVisit {
  url: string;
  title?: string;
  time_usec: number;
}

interface ChromeHistoryFile {
  "Browser History"?: ChromeVisit[];
}

// Hostname keyword → suggested category name + type fallback
const RULES: { match: RegExp; name: string; type: CategoryType }[] = [
  // Distractions
  { match: /(instagram|facebook|fb\.com|tiktok|snapchat|pinterest)/i, name: "Instagram", type: "distraction" },
  { match: /(twitter|x\.com|threads\.net|mastodon)/i, name: "Social", type: "distraction" },
  { match: /(reddit|9gag|imgur|tumblr|quora)/i, name: "Reddit", type: "distraction" },
  { match: /(youtube|youtu\.be|netflix|hotstar|primevideo|hulu|disneyplus|twitch)/i, name: "YouTube", type: "distraction" },
  { match: /(news|cnn|bbc|nytimes|washingtonpost|theverge|techcrunch|hackernews|ycombinator)/i, name: "News", type: "distraction" },
  { match: /(amazon|flipkart|myntra|ebay|aliexpress|shopify\.com\/shop)/i, name: "Shopping", type: "distraction" },
  // Work
  { match: /(github|gitlab|bitbucket|stackoverflow|stackexchange|lovable|figma|notion|linear|jira|confluence|slack|teams\.microsoft|zoom\.us|webex)/i, name: "Work", type: "focus" },
  { match: /(docs\.google|sheets\.google|slides\.google|drive\.google|gmail|calendar\.google|outlook|office\.com|onedrive)/i, name: "Work", type: "focus" },
  { match: /(meet\.google|hangouts)/i, name: "Meeting", type: "focus" },
  // Study
  { match: /(coursera|udemy|khanacademy|edx|magoosh|gregmat|manhattanprep|leetcode|hackerrank|wikipedia|chatgpt|claude\.ai|gemini\.google|perplexity)/i, name: "Study-Product", type: "focus" },
  { match: /(gre|ets\.org|gmat|toefl)/i, name: "Study-GRE", type: "focus" },
  // Neutral
  { match: /(maps\.google|google\.com\/maps|uber|ola|swiggy|zomato|doordash)/i, name: "Transit", type: "neutral" },
];

function classify(url: string): { name: string; type: CategoryType } {
  for (const r of RULES) if (r.match.test(url)) return { name: r.name, type: r.type };
  return { name: "Browsing", type: "distraction" };
}

function findCategory(cats: Category[], name: string): Category | undefined {
  const lower = name.toLowerCase();
  return cats.find((c) => c.name.toLowerCase() === lower)
    ?? cats.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()));
}

function hostFromUrl(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

export interface ImportSegment {
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  start: number;
  end: number;
  note?: string;
  link?: string;
  visits: number;
}

export interface ImportPlan {
  totalVisits: number;
  segments: ImportSegment[];
  byCategory: Record<string, { count: number; ms: number; type: CategoryType }>;
  unmatchedNames: string[];
}

export interface ImportOptions {
  gapMinutes?: number; // gap that ends a segment
  defaultDurationSec?: number; // duration assigned to a single isolated visit
  maxVisitDurationMin?: number; // cap for time between visits within a segment
  fromMs?: number;
  toMs?: number;
}

export function buildImportPlan(
  raw: unknown,
  categories: Category[],
  opts: ImportOptions = {},
): ImportPlan {
  const gapMs = (opts.gapMinutes ?? 5) * 60_000;
  const defaultDur = (opts.defaultDurationSec ?? 60) * 1000;
  const maxVisitMs = (opts.maxVisitDurationMin ?? 10) * 60_000;

  const data = raw as ChromeHistoryFile;
  const all = (data["Browser History"] ?? []).filter((v) => v && typeof v.url === "string" && typeof v.time_usec === "number");
  const visits = all
    .map((v) => ({ ...v, ms: Math.floor(v.time_usec / 1000) }))
    .filter((v) => (!opts.fromMs || v.ms >= opts.fromMs) && (!opts.toMs || v.ms <= opts.toMs))
    .sort((a, b) => a.ms - b.ms);

  const segments: ImportSegment[] = [];
  const unmatched = new Set<string>();
  let cur: { name: string; type: CategoryType; categoryId: string; start: number; lastMs: number; hosts: Set<string>; firstUrl: string; count: number } | null = null;

  const flush = () => {
    if (!cur) return;
    const end = Math.max(cur.start + 30_000, cur.lastMs + Math.min(defaultDur, maxVisitMs));
    segments.push({
      categoryId: cur.categoryId,
      categoryName: cur.name,
      type: cur.type,
      start: cur.start,
      end,
      note: Array.from(cur.hosts).slice(0, 4).join(", "),
      link: cur.firstUrl,
      visits: cur.count,
    });
    cur = null;
  };

  for (const v of visits) {
    const cls = classify(v.url);
    const cat = findCategory(categories, cls.name);
    if (!cat) unmatched.add(cls.name);
    const categoryId = cat?.id ?? `__pending__${cls.name}`;
    const host = hostFromUrl(v.url);

    if (!cur || cur.categoryId !== categoryId || v.ms - cur.lastMs > gapMs) {
      flush();
      cur = { name: cat?.name ?? cls.name, type: cat?.type ?? cls.type, categoryId, start: v.ms, lastMs: v.ms, hosts: new Set([host]), firstUrl: v.url, count: 1 };
    } else {
      cur.lastMs = v.ms;
      cur.hosts.add(host);
      cur.count++;
    }
  }
  flush();

  const byCategory: ImportPlan["byCategory"] = {};
  for (const s of segments) {
    const k = s.categoryName;
    if (!byCategory[k]) byCategory[k] = { count: 0, ms: 0, type: s.type };
    byCategory[k].count += 1;
    byCategory[k].ms += s.end - s.start;
  }

  return { totalVisits: visits.length, segments, byCategory, unmatchedNames: Array.from(unmatched) };
}
