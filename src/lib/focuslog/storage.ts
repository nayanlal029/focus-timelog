import type { Category, TimeBlock } from "./types";

const KEYS = {
  categories: "focuslog.categories.v1",
  blocks: "focuslog.blocks.v1",
  theme: "focuslog.theme.v1",
  active: "focuslog.active.v1",
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "c-work", name: "Work", type: "focus", order: 0, builtin: true },
  { id: "c-work-meet", name: "Work-Meet", type: "focus", order: 1, builtin: true },
  { id: "c-study", name: "Study", type: "focus", order: 2, builtin: true },
  { id: "c-study-product", name: "Study-Product", type: "focus", order: 3, builtin: true },
  { id: "c-gym", name: "Gym", type: "focus", order: 4, builtin: true },
  { id: "c-podcast", name: "Podcast", type: "neutral", order: 5, builtin: true },
  { id: "c-social-insta", name: "Social-Insta", type: "distraction", order: 6, builtin: true },
];

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const storage = {
  loadCategories(): Category[] {
    const cats = safeRead<Category[] | null>(KEYS.categories, null);
    if (!cats || cats.length === 0) {
      safeWrite(KEYS.categories, DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    return cats.sort((a, b) => a.order - b.order);
  },
  saveCategories(c: Category[]) {
    safeWrite(KEYS.categories, c);
  },
  loadBlocks(): TimeBlock[] {
    return safeRead<TimeBlock[]>(KEYS.blocks, []);
  },
  saveBlocks(b: TimeBlock[]) {
    safeWrite(KEYS.blocks, b);
  },
  loadTheme(): "dark" | "light" {
    return safeRead<"dark" | "light">(KEYS.theme, "dark");
  },
  saveTheme(t: "dark" | "light") {
    safeWrite(KEYS.theme, t);
  },
  loadActive(): ActiveState | null {
    return safeRead<ActiveState | null>(KEYS.active, null);
  },
  saveActive(a: ActiveState | null) {
    safeWrite(KEYS.active, a);
  },
  clearAll() {
    if (typeof window === "undefined") return;
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};

export interface ActiveState {
  categoryId: string;
  startedAt: number; // epoch ms when activity began (original)
  accumulatedMs: number; // active time before current run segment
  runningSince: number | null; // null if paused; else epoch ms when current run started
  breakStartedAt: number | null; // epoch ms when current break started (null if running)
  breaks: { start: number; end: number }[]; // completed breaks during this activity
}
