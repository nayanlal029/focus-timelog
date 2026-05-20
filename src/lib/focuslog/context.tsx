import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { storage, DEFAULT_CATEGORIES, type ActiveState } from "./storage";
import { BREAK_CATEGORY_ID, type Category, type CategoryType, type TimeBlock } from "./types";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";

interface FocusLogContextValue {
  ready: boolean;
  syncing: boolean;
  categories: Category[];
  blocks: TimeBlock[];
  active: ActiveState | null;
  liveTick: number;
  theme: "dark" | "light";
  // category ops
  addCategory: (name: string, type: CategoryType) => Category;
  updateCategory: (id: string, patch: Partial<Pick<Category, "name" | "type">>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (ids: string[]) => void;
  // active activity
  startActivity: (categoryId: string) => void;
  pauseActivity: () => void;
  resumeActivity: () => void;
  stopActivity: (note?: string) => { activity: TimeBlock | null; breaks: TimeBlock[] };
  cancelActivity: () => void;
  // blocks
  addPastBlock: (input: { categoryId: string; start: number; end: number; note?: string; link?: string }) => void;
  addManyPastBlocks: (inputs: { categoryId: string; start: number; end: number; note?: string; link?: string }[]) => number;
  updateBlock: (id: string, patch: Partial<Pick<TimeBlock, "categoryId" | "start" | "end" | "note" | "link">>) => void;
  deleteBlock: (id: string) => void;
  deleteBlocks: (ids: string[]) => void;
  mergeBlocks: (ids: string[], categoryId: string, note?: string) => TimeBlock | null;
  // theme + data
  setTheme: (t: "dark" | "light") => void;
  clearAllData: () => void;
  // helpers
  getCategory: (id: string) => Category | undefined;
  computeActiveMs: () => number;
  computeBreakMs: () => number;
}

const FocusLogContext = createContext<FocusLogContextValue | null>(null);

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Map app types to DB types
type DbBlockRow = {
  id: string; user_id: string; category_id: string; category_name: string;
  type: CategoryType; start_ms: number; end_ms: number;
  note: string | null; link: string | null; is_break: boolean;
};
type DbCatRow = {
  id: string; user_id: string; name: string; type: CategoryType;
  order: number; builtin: boolean;
};

function blockFromRow(r: DbBlockRow): TimeBlock {
  return {
    id: r.id,
    categoryId: r.category_id,
    categoryName: r.category_name,
    type: r.type,
    start: Number(r.start_ms),
    end: Number(r.end_ms),
    note: r.note ?? undefined,
    link: r.link ?? undefined,
    isBreak: r.is_break || undefined,
  };
}

function categoryFromRow(r: DbCatRow): Category {
  return { id: r.id, name: r.name, type: r.type, order: r.order, builtin: r.builtin || undefined };
}

export function FocusLogProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady, guest } = useAuth();
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [active, setActive] = useState<ActiveState | null>(null);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [liveTick, setLiveTick] = useState(0);
  const tickRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Load theme/active from local storage immediately (UX, no auth needed)
  useEffect(() => {
    setThemeState(storage.loadTheme());
    setActive(storage.loadActive());
  }, []);

  // Hydrate from DB whenever the user changes (or locally in guest mode)
  useEffect(() => {
    if (!authReady) return;
    userIdRef.current = user?.id ?? null;

    // Guest mode: load purely from localStorage, no Supabase.
    if (!user && guest) {
      setCategories(storage.loadCategories());
      setBlocks(storage.loadBlocks());
      setReady(true);
      return;
    }

    if (!user) {
      setCategories([]);
      setBlocks([]);
      setReady(true);
      return;
    }
    let cancelled = false;
    setSyncing(true);
    (async () => {
      const [{ data: cats }, { data: blks }] = await Promise.all([
        supabase.from("categories").select("*").order("order", { ascending: true }),
        supabase.from("time_blocks").select("*").order("start_ms", { ascending: false }),
      ]);
      if (cancelled) return;

      let catList = (cats ?? []).map(categoryFromRow);
      let blockList = (blks ?? []).map(blockFromRow);

      // First-run: seed defaults from local storage if empty, else seed sample defaults
      if (catList.length === 0) {
        const localCats = storage.loadCategories();
        const localBlocks = storage.loadBlocks();
        const seedCats = localCats.length ? localCats : DEFAULT_CATEGORIES;
        const catRows = seedCats.map((c) => ({
          id: c.id, user_id: user.id, name: c.name, type: c.type,
          order: c.order, builtin: c.builtin ?? false,
        }));
        await supabase.from("categories").insert(catRows);
        catList = seedCats;
        if (localBlocks.length) {
          const validIds = new Set(catList.map((c) => c.id));
          validIds.add(BREAK_CATEGORY_ID);
          if (!catList.find((c) => c.id === BREAK_CATEGORY_ID)) {
            await supabase.from("categories").insert({
              id: BREAK_CATEGORY_ID, user_id: user.id, name: "Break", type: "neutral", order: 999, builtin: true,
            });
          }
          const blockRows = localBlocks.filter((b) => validIds.has(b.categoryId)).map((b) => ({
            id: b.id, user_id: user.id, category_id: b.categoryId, category_name: b.categoryName,
            type: b.type, start_ms: b.start, end_ms: b.end,
            note: b.note ?? null, link: b.link ?? null, is_break: b.isBreak ?? false,
          }));
          if (blockRows.length) await supabase.from("time_blocks").insert(blockRows);
          blockList = localBlocks;
        }
      }

      // Ensure a Break category exists (used for break blocks)
      if (!catList.find((c) => c.id === BREAK_CATEGORY_ID)) {
        await supabase.from("categories").insert({
          id: BREAK_CATEGORY_ID, user_id: user.id, name: "Break", type: "neutral", order: 999, builtin: true,
        });
      }

      setCategories(catList);
      setBlocks(blockList);
      setReady(true);
      setSyncing(false);
    })();

    // Realtime subscription for cross-device updates
    const ch = supabase
      .channel(`focuslog-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_blocks", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as DbBlockRow;
          setBlocks((bs) => bs.find((b) => b.id === r.id) ? bs : [...bs, blockFromRow(r)]);
        } else if (payload.eventType === "UPDATE") {
          const r = payload.new as DbBlockRow;
          setBlocks((bs) => bs.map((b) => b.id === r.id ? blockFromRow(r) : b));
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as DbBlockRow;
          setBlocks((bs) => bs.filter((b) => b.id !== r.id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "categories", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as DbCatRow;
          setCategories((cs) => cs.find((c) => c.id === r.id) ? cs : [...cs, categoryFromRow(r)].sort((a, b) => a.order - b.order));
        } else if (payload.eventType === "UPDATE") {
          const r = payload.new as DbCatRow;
          setCategories((cs) => cs.map((c) => c.id === r.id ? categoryFromRow(r) : c).sort((a, b) => a.order - b.order));
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as DbCatRow;
          setCategories((cs) => cs.filter((c) => c.id !== r.id));
        }
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user, authReady, guest]);

  // Persist categories/blocks locally in guest mode so they survive reloads.
  useEffect(() => {
    if (!ready || user) return;
    if (!guest) return;
    storage.saveCategories(categories);
  }, [categories, ready, user, guest]);
  useEffect(() => {
    if (!ready || user) return;
    if (!guest) return;
    storage.saveBlocks(blocks);
  }, [blocks, ready, user, guest]);

  // Apply theme class
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  }, [theme]);

  // Persist local-only bits
  useEffect(() => { storage.saveActive(active); }, [active]);
  useEffect(() => { storage.saveTheme(theme); }, [theme]);

  // Live ticking when active
  useEffect(() => {
    if (!active) {
      if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    if (tickRef.current) return;
    tickRef.current = window.setInterval(() => setLiveTick((n) => n + 1), 250);
    return () => {
      if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [active]);

  const getCategory = useCallback((id: string) => categories.find((c) => c.id === id), [categories]);

  const computeActiveMs = useCallback(() => {
    if (!active) return 0;
    let ms = active.accumulatedMs;
    if (active.runningSince) ms += Date.now() - active.runningSince;
    return ms;
  }, [active]);

  const computeBreakMs = useCallback(() => {
    if (!active || !active.breakStartedAt) return 0;
    return Date.now() - active.breakStartedAt;
  }, [active]);

  // ---------- DB write helpers (fire-and-forget; optimistic local updates) ----------
  const dbInsertBlock = (b: TimeBlock) => {
    const uid = userIdRef.current; if (!uid) return;
    void supabase.from("time_blocks").insert({
      id: b.id, user_id: uid, category_id: b.categoryId, category_name: b.categoryName,
      type: b.type, start_ms: b.start, end_ms: b.end,
      note: b.note ?? null, link: b.link ?? null, is_break: b.isBreak ?? false,
    }).then(({ error }) => { if (error) console.error("[sync] insert block", error); });
  };
  const dbInsertBlocks = (bs: TimeBlock[]) => {
    const uid = userIdRef.current; if (!uid || !bs.length) return;
    void supabase.from("time_blocks").insert(bs.map((b) => ({
      id: b.id, user_id: uid, category_id: b.categoryId, category_name: b.categoryName,
      type: b.type, start_ms: b.start, end_ms: b.end,
      note: b.note ?? null, link: b.link ?? null, is_break: b.isBreak ?? false,
    }))).then(({ error }) => { if (error) console.error("[sync] insert blocks", error); });
  };
  const dbUpdateBlock = (id: string, patch: Partial<TimeBlock>) => {
    const uid = userIdRef.current; if (!uid) return;
    const u: TablesUpdate<"time_blocks"> = {};
    if (patch.categoryId !== undefined) u.category_id = patch.categoryId;
    if (patch.categoryName !== undefined) u.category_name = patch.categoryName;
    if (patch.type !== undefined) u.type = patch.type;
    if (patch.start !== undefined) u.start_ms = patch.start;
    if (patch.end !== undefined) u.end_ms = patch.end;
    if (patch.note !== undefined) u.note = patch.note ?? null;
    if (patch.link !== undefined) u.link = patch.link ?? null;
    void supabase.from("time_blocks").update(u).eq("id", id).eq("user_id", uid)
      .then(({ error }) => { if (error) console.error("[sync] update block", error); });
  };
  const dbDeleteBlocks = (ids: string[]) => {
    const uid = userIdRef.current; if (!uid || !ids.length) return;
    void supabase.from("time_blocks").delete().in("id", ids).eq("user_id", uid)
      .then(({ error }) => { if (error) console.error("[sync] delete blocks", error); });
  };

  const dbInsertCategory = (c: Category) => {
    const uid = userIdRef.current; if (!uid) return;
    void supabase.from("categories").insert({
      id: c.id, user_id: uid, name: c.name, type: c.type, order: c.order, builtin: c.builtin ?? false,
    }).then(({ error }) => { if (error) console.error("[sync] insert cat", error); });
  };
  const dbUpdateCategory = (id: string, patch: Partial<Category>) => {
    const uid = userIdRef.current; if (!uid) return;
    void supabase.from("categories").update(patch).eq("id", id).eq("user_id", uid)
      .then(({ error }) => { if (error) console.error("[sync] update cat", error); });
  };
  const dbDeleteCategory = (id: string) => {
    const uid = userIdRef.current; if (!uid) return;
    void supabase.from("categories").delete().eq("id", id).eq("user_id", uid)
      .then(({ error }) => { if (error) console.error("[sync] delete cat", error); });
  };

  // ---------- category ops ----------
  const addCategory = useCallback((name: string, type: CategoryType): Category => {
    const cat: Category = { id: uid("c"), name: name.trim() || "Untitled", type, order: categories.length };
    setCategories((prev) => [...prev, cat]);
    dbInsertCategory(cat);
    return cat;
  }, [categories.length]);

  const updateCategory = useCallback((id: string, patch: Partial<Pick<Category, "name" | "type">>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    dbUpdateCategory(id, patch);
    if (patch.type || patch.name) {
      const blockPatch: Partial<TimeBlock> = {};
      if (patch.type) blockPatch.type = patch.type;
      if (patch.name) blockPatch.categoryName = patch.name;
      setBlocks((prev) => prev.map((b) => b.categoryId === id ? { ...b, ...blockPatch } : b));
      // Bulk update DB
      const uidv = userIdRef.current;
      if (uidv) {
        const u: TablesUpdate<"time_blocks"> = {};
        if (patch.type) u.type = patch.type;
        if (patch.name) u.category_name = patch.name;
        void supabase.from("time_blocks").update(u).eq("category_id", id).eq("user_id", uidv);
      }
    }
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i })));
    dbDeleteCategory(id);
    // re-sync orders
    const uidv = userIdRef.current;
    if (uidv) {
      setCategories((cs) => {
        cs.forEach((c, i) => { if (c.order !== i) dbUpdateCategory(c.id, { order: i }); });
        return cs;
      });
    }
  }, []);

  const reorderCategories = useCallback((ids: string[]) => {
    setCategories((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      const ordered: Category[] = [];
      ids.forEach((id, i) => {
        const c = map.get(id);
        if (c) {
          if (c.order !== i) dbUpdateCategory(c.id, { order: i });
          ordered.push({ ...c, order: i });
          map.delete(id);
        }
      });
      Array.from(map.values()).forEach((c) => {
        const idx = ordered.length;
        if (c.order !== idx) dbUpdateCategory(c.id, { order: idx });
        ordered.push({ ...c, order: idx });
      });
      return ordered;
    });
  }, []);

  // ---------- active activity ----------
  const startActivity = useCallback((categoryId: string) => {
    if (active) return;
    const now = Date.now();
    setActive({ categoryId, startedAt: now, accumulatedMs: 0, runningSince: now, breakStartedAt: null, breaks: [] });
  }, [active]);

  const pauseActivity = useCallback(() => {
    setActive((prev) => {
      if (!prev || !prev.runningSince) return prev;
      const now = Date.now();
      return { ...prev, accumulatedMs: prev.accumulatedMs + (now - prev.runningSince), runningSince: null, breakStartedAt: now };
    });
  }, []);

  const resumeActivity = useCallback(() => {
    setActive((prev) => {
      if (!prev || prev.runningSince || !prev.breakStartedAt) return prev;
      const now = Date.now();
      const breakBlock = { start: prev.breakStartedAt, end: now };
      const block: TimeBlock = {
        id: uid("b"), categoryId: BREAK_CATEGORY_ID, categoryName: "Break", type: "neutral",
        start: breakBlock.start, end: breakBlock.end, isBreak: true,
      };
      setBlocks((bs) => [...bs, block]);
      dbInsertBlock(block);
      return { ...prev, runningSince: now, breakStartedAt: null, breaks: [...prev.breaks, breakBlock] };
    });
  }, []);

  const stopActivity = useCallback((note?: string) => {
    if (!active) return { activity: null, breaks: [] };
    const now = Date.now();
    const cat = getCategory(active.categoryId);
    if (!cat) { setActive(null); return { activity: null, breaks: [] }; }
    const newBreaks: TimeBlock[] = [];
    let endTime = now;
    if (active.breakStartedAt) {
      endTime = active.breakStartedAt;
      newBreaks.push({
        id: uid("b"), categoryId: BREAK_CATEGORY_ID, categoryName: "Break", type: "neutral",
        start: active.breakStartedAt, end: now, isBreak: true,
      });
    }
    const activity: TimeBlock = {
      id: uid("a"), categoryId: cat.id, categoryName: cat.name, type: cat.type,
      start: active.startedAt, end: endTime, note: note?.trim() || undefined,
    };
    setBlocks((bs) => [...bs, activity, ...newBreaks]);
    dbInsertBlocks([activity, ...newBreaks]);
    setActive(null);
    return { activity, breaks: newBreaks };
  }, [active, getCategory]);

  const cancelActivity = useCallback(() => setActive(null), []);

  const addPastBlock = useCallback(({ categoryId, start, end, note, link }: { categoryId: string; start: number; end: number; note?: string; link?: string }) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat || end <= start) return;
    const block: TimeBlock = {
      id: uid("p"), categoryId: cat.id, categoryName: cat.name, type: cat.type,
      start, end, note: note?.trim() || undefined, link: link?.trim() || undefined,
    };
    setBlocks((bs) => [...bs, block]);
    dbInsertBlock(block);
  }, [categories]);

  const addManyPastBlocks = useCallback((inputs: { categoryId: string; start: number; end: number; note?: string; link?: string }[]) => {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const seen = new Set(blocks.map((b) => `${b.categoryId}|${b.start}|${b.end}`));
    const created: TimeBlock[] = [];
    for (const i of inputs) {
      const cat = catMap.get(i.categoryId);
      if (!cat || i.end <= i.start) continue;
      const key = `${i.categoryId}|${i.start}|${i.end}`;
      if (seen.has(key)) continue; // skip exact duplicate
      seen.add(key);
      created.push({
        id: uid("p"), categoryId: cat.id, categoryName: cat.name, type: cat.type,
        start: i.start, end: i.end,
        note: i.note?.trim() || undefined, link: i.link?.trim() || undefined,
      });
    }
    if (created.length) {
      setBlocks((bs) => [...bs, ...created]);
      dbInsertBlocks(created);
    }
    return created.length;
  }, [categories, blocks]);

  const updateBlock = useCallback((id: string, patch: Partial<Pick<TimeBlock, "categoryId" | "start" | "end" | "note" | "link">>) => {
    let appliedPatch: Partial<TimeBlock> = patch;
    setBlocks((bs) => bs.map((b) => {
      if (b.id !== id) return b;
      const next: TimeBlock = { ...b, ...patch };
      if (patch.categoryId && patch.categoryId !== b.categoryId) {
        const cat = categories.find((c) => c.id === patch.categoryId);
        if (cat) {
          next.categoryName = cat.name;
          next.type = cat.type;
          appliedPatch = { ...patch, categoryName: cat.name, type: cat.type };
        }
      }
      return next;
    }));
    dbUpdateBlock(id, appliedPatch);
  }, [categories]);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    dbDeleteBlocks([id]);
  }, []);

  const deleteBlocks = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setBlocks((bs) => bs.filter((b) => !idSet.has(b.id)));
    dbDeleteBlocks(ids);
  }, []);

  const mergeBlocks = useCallback((ids: string[], categoryId: string, note?: string): TimeBlock | null => {
    if (ids.length < 2) return null;
    const idSet = new Set(ids);
    const targets = blocks.filter((b) => idSet.has(b.id));
    if (targets.length < 2) return null;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return null;
    const start = Math.min(...targets.map((b) => b.start));
    const end = Math.max(...targets.map((b) => b.end));
    const merged: TimeBlock = {
      id: uid("m"), categoryId: cat.id, categoryName: cat.name, type: cat.type,
      start, end, note: note?.trim() || undefined,
    };
    setBlocks((bs) => [...bs.filter((b) => !idSet.has(b.id)), merged]);
    dbInsertBlock(merged);
    dbDeleteBlocks(ids);
    return merged;
  }, [blocks, categories]);

  const setTheme = useCallback((t: "dark" | "light") => setThemeState(t), []);

  const clearAllData = useCallback(() => {
    const allBlockIds = blocks.map((b) => b.id);
    const allCatIds = categories.map((c) => c.id);
    setBlocks([]);
    setCategories([]);
    setActive(null);
    storage.clearAll();
    if (allBlockIds.length) dbDeleteBlocks(allBlockIds);
    const uidv = userIdRef.current;
    if (uidv && allCatIds.length) {
      void supabase.from("categories").delete().in("id", allCatIds).eq("user_id", uidv);
    }
  }, [blocks, categories]);

  const value = useMemo<FocusLogContextValue>(() => ({
    ready, syncing, categories, blocks, active, liveTick, theme,
    addCategory, updateCategory, deleteCategory, reorderCategories,
    startActivity, pauseActivity, resumeActivity, stopActivity, cancelActivity,
    addPastBlock, addManyPastBlocks, updateBlock, deleteBlock, deleteBlocks, mergeBlocks,
    setTheme, clearAllData,
    getCategory, computeActiveMs, computeBreakMs,
  }), [ready, syncing, categories, blocks, active, liveTick, theme, addCategory, updateCategory, deleteCategory, reorderCategories, startActivity, pauseActivity, resumeActivity, stopActivity, cancelActivity, addPastBlock, addManyPastBlocks, updateBlock, deleteBlock, deleteBlocks, mergeBlocks, setTheme, clearAllData, getCategory, computeActiveMs, computeBreakMs]);

  return <FocusLogContext.Provider value={value}>{children}</FocusLogContext.Provider>;
}

export function useFocusLog() {
  const ctx = useContext(FocusLogContext);
  if (!ctx) throw new Error("useFocusLog must be used within FocusLogProvider");
  return ctx;
}
