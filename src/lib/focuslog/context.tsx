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
import { storage, type ActiveState } from "./storage";
import { BREAK_CATEGORY_ID, type Category, type CategoryType, type TimeBlock } from "./types";

interface FocusLogContextValue {
  ready: boolean;
  categories: Category[];
  blocks: TimeBlock[];
  active: ActiveState | null;
  liveTick: number; // re-renders every second when needed
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
  addPastBlock: (input: { categoryId: string; start: number; end: number; note?: string }) => void;
  updateBlock: (id: string, patch: Partial<Pick<TimeBlock, "categoryId" | "start" | "end" | "note">>) => void;
  deleteBlock: (id: string) => void;
  // theme + data
  setTheme: (t: "dark" | "light") => void;
  clearAllData: () => void;
  // helpers
  getCategory: (id: string) => Category | undefined;
  computeActiveMs: () => number; // active stopwatch elapsed
  computeBreakMs: () => number; // current break elapsed (0 if not paused)
}

const FocusLogContext = createContext<FocusLogContextValue | null>(null);

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FocusLogProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [active, setActive] = useState<ActiveState | null>(null);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [liveTick, setLiveTick] = useState(0);
  const tickRef = useRef<number | null>(null);

  // boot
  useEffect(() => {
    setCategories(storage.loadCategories());
    setBlocks(storage.loadBlocks());
    setActive(storage.loadActive());
    const t = storage.loadTheme();
    setThemeState(t);
    setReady(true);
  }, []);

  // apply theme class
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  }, [theme]);

  // persistence
  useEffect(() => { if (ready) storage.saveCategories(categories); }, [categories, ready]);
  useEffect(() => { if (ready) storage.saveBlocks(blocks); }, [blocks, ready]);
  useEffect(() => { if (ready) storage.saveActive(active); }, [active, ready]);
  useEffect(() => { if (ready) storage.saveTheme(theme); }, [theme, ready]);

  // live ticking when an activity exists
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

  // category ops
  const addCategory = useCallback((name: string, type: CategoryType): Category => {
    const cat: Category = {
      id: uid("c"),
      name: name.trim() || "Untitled",
      type,
      order: categories.length,
    };
    setCategories((prev) => [...prev, cat]);
    return cat;
  }, [categories.length]);

  const updateCategory = useCallback((id: string, patch: Partial<Pick<Category, "name" | "type">>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (patch.type || patch.name) {
      setBlocks((prev) => prev.map((b) => b.categoryId === id ? {
        ...b,
        type: patch.type ?? b.type,
        categoryName: patch.name ?? b.categoryName,
      } : b));
    }
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i })));
  }, []);

  const reorderCategories = useCallback((ids: string[]) => {
    setCategories((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      const ordered: Category[] = [];
      ids.forEach((id, i) => {
        const c = map.get(id);
        if (c) { ordered.push({ ...c, order: i }); map.delete(id); }
      });
      // append any missing at end
      Array.from(map.values()).forEach((c) => ordered.push({ ...c, order: ordered.length }));
      return ordered;
    });
  }, []);

  // active activity
  const startActivity = useCallback((categoryId: string) => {
    if (active) return; // ignore if already running
    const now = Date.now();
    setActive({
      categoryId,
      startedAt: now,
      accumulatedMs: 0,
      runningSince: now,
      breakStartedAt: null,
      breaks: [],
    });
  }, [active]);

  const pauseActivity = useCallback(() => {
    setActive((prev) => {
      if (!prev || !prev.runningSince) return prev;
      const now = Date.now();
      return {
        ...prev,
        accumulatedMs: prev.accumulatedMs + (now - prev.runningSince),
        runningSince: null,
        breakStartedAt: now,
      };
    });
  }, []);

  const resumeActivity = useCallback(() => {
    setActive((prev) => {
      if (!prev || prev.runningSince || !prev.breakStartedAt) return prev;
      const now = Date.now();
      const breakBlock = { start: prev.breakStartedAt, end: now };
      // log break as separate Neutral block
      setBlocks((bs) => [...bs, {
        id: uid("b"),
        categoryId: BREAK_CATEGORY_ID,
        categoryName: "Break",
        type: "neutral",
        start: breakBlock.start,
        end: breakBlock.end,
        isBreak: true,
      }]);
      return {
        ...prev,
        runningSince: now,
        breakStartedAt: null,
        breaks: [...prev.breaks, breakBlock],
      };
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
      // Stopping from break popup: activity ended at pause moment, break is its own block
      endTime = active.breakStartedAt;
      newBreaks.push({
        id: uid("b"),
        categoryId: BREAK_CATEGORY_ID,
        categoryName: "Break",
        type: "neutral",
        start: active.breakStartedAt,
        end: now,
        isBreak: true,
      });
    }
    const activity: TimeBlock = {
      id: uid("a"),
      categoryId: cat.id,
      categoryName: cat.name,
      type: cat.type,
      start: active.startedAt,
      end: endTime,
      note: note?.trim() || undefined,
    };
    setBlocks((bs) => [...bs, activity, ...newBreaks]);
    setActive(null);
    return { activity, breaks: newBreaks };
  }, [active, getCategory]);

  const cancelActivity = useCallback(() => setActive(null), []);

  const addPastBlock = useCallback(({ categoryId, start, end, note }: { categoryId: string; start: number; end: number; note?: string }) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat || end <= start) return;
    setBlocks((bs) => [...bs, {
      id: uid("p"),
      categoryId: cat.id,
      categoryName: cat.name,
      type: cat.type,
      start, end,
      note: note?.trim() || undefined,
    }]);
  }, [categories]);

  const updateBlock = useCallback((id: string, patch: Partial<Pick<TimeBlock, "categoryId" | "start" | "end" | "note">>) => {
    setBlocks((bs) => bs.map((b) => {
      if (b.id !== id) return b;
      const next = { ...b, ...patch };
      if (patch.categoryId && patch.categoryId !== b.categoryId) {
        const cat = categories.find((c) => c.id === patch.categoryId);
        if (cat) { next.categoryName = cat.name; next.type = cat.type; }
      }
      return next;
    }));
  }, [categories]);

  const deleteBlock = useCallback((id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
  }, []);

  const setTheme = useCallback((t: "dark" | "light") => setThemeState(t), []);
  const clearAllData = useCallback(() => {
    storage.clearAll();
    setCategories(storage.loadCategories());
    setBlocks([]);
    setActive(null);
  }, []);

  const value = useMemo<FocusLogContextValue>(() => ({
    ready, categories, blocks, active, liveTick, theme,
    addCategory, updateCategory, deleteCategory, reorderCategories,
    startActivity, pauseActivity, resumeActivity, stopActivity, cancelActivity,
    addPastBlock, updateBlock, deleteBlock,
    setTheme, clearAllData,
    getCategory, computeActiveMs, computeBreakMs,
  }), [ready, categories, blocks, active, liveTick, theme, addCategory, updateCategory, deleteCategory, reorderCategories, startActivity, pauseActivity, resumeActivity, stopActivity, cancelActivity, addPastBlock, updateBlock, deleteBlock, setTheme, clearAllData, getCategory, computeActiveMs, computeBreakMs]);

  return <FocusLogContext.Provider value={value}>{children}</FocusLogContext.Provider>;
}

export function useFocusLog() {
  const ctx = useContext(FocusLogContext);
  if (!ctx) throw new Error("useFocusLog must be used within FocusLogProvider");
  return ctx;
}
