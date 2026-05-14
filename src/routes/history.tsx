import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, Filter, X } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { dayKey, fmtDuration } from "@/lib/focuslog/format";
import { Timeline } from "@/components/focuslog/Timeline";
import { HourGantt } from "@/components/focuslog/HourGantt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportBlocksToXlsx } from "@/lib/focuslog/export";
import { cn } from "@/lib/utils";

function toInputDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "FocusLog — History" }] }),
  component: HistoryScreen,
});

function HistoryScreen() {
  const { blocks } = useFocusLog();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(dayKey(today.getTime()));
  const [filterOpen, setFilterOpen] = useState(false);
  const [from, setFrom] = useState<string>(toInputDate(today.getTime() - 6 * 86400000));
  const [to, setTo] = useState<string>(toInputDate(today.getTime()));
  const [fromTime, setFromTime] = useState<string>("00:00");
  const [toTime, setToTime] = useState<string>("23:59");

  const filterRange = useMemo(() => {
    if (!from || !to) return null;
    const start = new Date(`${from}T${fromTime || "00:00"}:00`).getTime();
    const end = new Date(`${to}T${toTime || "23:59"}:59`).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;
    return { start, end };
  }, [from, to, fromTime, toTime]);

  const filteredBlocks = useMemo(() => {
    if (!filterRange) return [];
    return blocks.filter((b) => b.start >= filterRange.start && b.start <= filterRange.end);
  }, [blocks, filterRange]);

  const filteredTotals = useMemo(() => {
    const t = { focus: 0, distraction: 0, neutral: 0 };
    filteredBlocks.forEach((b) => {
      const d = b.end - b.start;
      if (b.type === "focus") t.focus += d;
      else if (b.type === "distraction") t.distraction += d;
      else t.neutral += d;
    });
    return t;
  }, [filteredBlocks]);

  const downloadFiltered = () => {
    if (!filterRange || filteredBlocks.length === 0) return;
    exportBlocksToXlsx(filteredBlocks, `focuslog-${from}_to_${to}.xlsx`);
  };


  const monthLabel = cursor.toLocaleDateString([], { month: "long", year: "numeric" });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const blocksByDay = useMemo(() => {
    const map = new Map<string, { focus: number; distraction: number; neutral: number; count: number }>();
    blocks.forEach((b) => {
      const k = dayKey(b.start);
      const cur = map.get(k) ?? { focus: 0, distraction: 0, neutral: 0, count: 0 };
      const dur = b.end - b.start;
      if (b.type === "focus") cur.focus += dur;
      else if (b.type === "distraction") cur.distraction += dur;
      else cur.neutral += dur;
      cur.count += 1;
      map.set(k, cur);
    });
    return map;
  }, [blocks]);

  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    cells.push({ day: d, key: dayKey(date.getTime()) });
  }

  const dayBlocks = blocks.filter((b) => dayKey(b.start) === selected);
  const summary = blocksByDay.get(selected);
  const selectedDayStart = new Date(selected + "T00:00:00").getTime();

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
            {filterOpen ? "Close" : "Filter & Export"}
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

      {filterOpen && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="from-date" className="text-[11px] uppercase tracking-wider text-muted-foreground">From</Label>
              <Input id="from-date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input aria-label="From time" type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to-date" className="text-[11px] uppercase tracking-wider text-muted-foreground">To</Label>
              <Input id="to-date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <Input aria-label="To time" type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Today", days: 0 },
              { label: "7d", days: 6 },
              { label: "30d", days: 29 },
              { label: "90d", days: 89 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setFrom(toInputDate(today.getTime() - p.days * 86400000));
                  setTo(toInputDate(today.getTime()));
                  setFromTime("00:00");
                  setToTime("23:59");
                }}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
            <div className="tabular-nums">
              <span className="text-muted-foreground">{filteredBlocks.length} entries · </span>
              <span className="text-focus">{fmtDuration(filteredTotals.focus)}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-distraction">{fmtDuration(filteredTotals.distraction)}</span>
            </div>
            <Button size="sm" onClick={downloadFiltered} disabled={!filterRange || filteredBlocks.length === 0}>
              <Download className="h-4 w-4" /> Download .xlsx
            </Button>
          </div>
        </section>
      )}


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
    </div>
  );
}
