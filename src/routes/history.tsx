import { useDeferredValue, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { useFilter } from "@/lib/focuslog/filter-context";
import { dayKey, fmtDuration } from "@/lib/focuslog/format";
import { overlapMs } from "@/lib/focuslog/aggregate";
import { Timeline } from "@/components/focuslog/Timeline";
import { HourGantt } from "@/components/focuslog/HourGantt";
import { FilterPanel } from "@/components/focuslog/FilterPanel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "FocusLog — History" }] }),
  component: HistoryScreen,
});

function HistoryScreen() {
  const { blocks } = useFocusLog();
  const { range } = useFilter();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(dayKey(today.getTime()));
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [catQuery, setCatQuery] = useState("");
  const deferredQuery = useDeferredValue(catQuery);

  const filteredBlocks = useMemo(() => {
    if (!range) return [];
    return blocks.filter((b) => overlapMs(b.start, b.end, range.start, range.end) > 0);
  }, [blocks, range]);

  const filteredTotals = useMemo(() => {
    const t = { focus: 0, distraction: 0, neutral: 0 };
    if (!range) return t;
    filteredBlocks.forEach((b) => {
      const d = overlapMs(b.start, b.end, range.start, range.end);
      if (b.type === "focus") t.focus += d;
      else if (b.type === "distraction") t.distraction += d;
      else t.neutral += d;
    });
    return t;
  }, [filteredBlocks, range]);

  const monthLabel = cursor.toLocaleDateString([], { month: "long", year: "numeric" });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const blocksByDay = useMemo(() => {
    const map = new Map<string, { focus: number; distraction: number; neutral: number; count: number }>();
    blocks.forEach((b) => {
      const dStart = new Date(b.start); dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(b.end); dEnd.setHours(0, 0, 0, 0);
      const oneDay = 86400000;
      for (let t = dStart.getTime(); t <= dEnd.getTime(); t += oneDay) {
        const dayStart = t;
        const dayEnd = t + oneDay - 1;
        const ms = overlapMs(b.start, b.end, dayStart, dayEnd);
        if (ms <= 0) continue;
        const k = dayKey(t);
        const cur = map.get(k) ?? { focus: 0, distraction: 0, neutral: 0, count: 0 };
        if (b.type === "focus") cur.focus += ms;
        else if (b.type === "distraction") cur.distraction += ms;
        else cur.neutral += ms;
        if (t === dStart.getTime()) cur.count += 1;
        map.set(k, cur);
      }
    });
    return map;
  }, [blocks]);

  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    cells.push({ day: d, key: dayKey(date.getTime()) });
  }

  const selectedDayStart = new Date(selected + "T00:00:00").getTime();
  const selectedDayEnd = selectedDayStart + 86400000 - 1;
  const q = deferredQuery.trim().toLowerCase();
  const dayBlocks = blocks.filter((b) => {
    if (overlapMs(b.start, b.end, selectedDayStart, selectedDayEnd) <= 0) return false;
    if (q && !b.categoryName.toLowerCase().includes(q)) return false;
    return true;
  });
  const summary = blocksByDay.get(selected);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header>
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">History</div>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filterOpen ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground",
            )}
          >
            {filterOpen ? <X className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
            {filterOpen ? "Close" : "Filter"}
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded-full border border-border bg-card p-2"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-semibold">{monthLabel}</h1>
          <button
            type="button"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded-full border border-border bg-card p-2"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {filterOpen && <FilterPanel onView={() => setViewOpen(true)} />}

      <div>
        <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="aspect-square" />;
            const data = blocksByDay.get(c.key);
            const isSelected = selected === c.key;
            const isToday = c.key === dayKey(Date.now());
            const total = data ? data.focus + data.distraction + data.neutral : 0;
            const focusPct = total > 0 ? (data!.focus / total) * 100 : 0;
            const distPct = total > 0 ? (data!.distraction / total) * 100 : 0;
            const focusH = data ? data.focus / 3600000 : 0;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelected(c.key)}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-start rounded-xl border p-1 text-xs font-medium transition-colors",
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card text-foreground/85",
                  isToday && !isSelected && "ring-1 ring-accent/60",
                )}
              >
                <span className="text-[13px] leading-none">{c.day}</span>
                {data ? (
                  <>
                    <span className={cn(
                      "mt-0.5 text-[9px] tabular-nums leading-none",
                      isSelected ? "opacity-90" : "text-muted-foreground",
                    )}>
                      {focusH >= 1 ? `${focusH.toFixed(1)}h` : `${Math.round(data.focus / 60000)}m`}
                    </span>
                    <div className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-background/40">
                      <div className="flex h-full">
                        <div className="h-full bg-focus" style={{ width: `${focusPct}%` }} />
                        <div className="h-full bg-distraction" style={{ width: `${distPct}%` }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-background/30 opacity-40" />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-end gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-focus" /> Focus</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-distraction" /> Distraction</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            {new Date(selected + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
          </h2>
          {summary && (
            <span className="text-xs tabular-nums">
              <span className="text-focus">{fmtDuration(summary.focus)}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-distraction">{fmtDuration(summary.distraction)}</span>
            </span>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Day timeline</div>
          <HourGantt blocks={dayBlocks} dayStart={selectedDayStart} />
        </div>

        <Timeline blocks={dayBlocks} emptyLabel="Nothing logged on this day." />
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Filtered sessions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs tabular-nums">
            <div>
              <span className="text-muted-foreground">{filteredBlocks.length} entries · </span>
              <span className="text-focus">{fmtDuration(filteredTotals.focus)}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-distraction">{fmtDuration(filteredTotals.distraction)}</span>
            </div>
            <Timeline blocks={filteredBlocks} emptyLabel="No sessions in this range." />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
