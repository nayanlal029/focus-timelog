import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

function toInputDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FilterState {
  from: string;
  to: string;
  fromTime: string;
  toTime: string;
}

interface FilterContextValue extends FilterState {
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setFromTime: (v: string) => void;
  setToTime: (v: string) => void;
  range: { start: number; end: number } | null;
  applyPreset: (days: number) => void;
}

const STORAGE_KEY = "focuslog.filter.v1";

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilterState>(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      from: toInputDate(today.getTime() - 6 * 86400000),
      to: toInputDate(today.getTime()),
      fromTime: "00:00",
      toTime: "23:59",
    };
  });

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) setState((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const setFrom = useCallback((v: string) => setState((s) => ({ ...s, from: v })), []);
  const setTo = useCallback((v: string) => setState((s) => ({ ...s, to: v })), []);
  const setFromTime = useCallback((v: string) => setState((s) => ({ ...s, fromTime: v })), []);
  const setToTime = useCallback((v: string) => setState((s) => ({ ...s, toTime: v })), []);

  const applyPreset = useCallback((days: number) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    setState({
      from: toInputDate(today.getTime() - days * 86400000),
      to: toInputDate(today.getTime()),
      fromTime: "00:00",
      toTime: "23:59",
    });
  }, []);

  const range = useMemo(() => {
    if (!state.from || !state.to) return null;
    const start = new Date(`${state.from}T${state.fromTime || "00:00"}:00`).getTime();
    const end = new Date(`${state.to}T${state.toTime || "23:59"}:59`).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;
    return { start, end };
  }, [state]);

  const value = useMemo<FilterContextValue>(() => ({
    ...state, setFrom, setTo, setFromTime, setToTime, range, applyPreset,
  }), [state, setFrom, setTo, setFromTime, setToTime, range, applyPreset]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}
