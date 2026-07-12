import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { HourGantt } from "@/components/focuslog/HourGantt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtClock, fmtDuration, startOfDay, endOfDay } from "@/lib/focuslog/format";
import type { TimeBlock } from "@/lib/focuslog/types";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "FocusLog — Calendar" }] }),
  component: CalendarScreen,
});

function toDateInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromDateInput(s: string): number {
  const ms = new Date(s + "T00:00:00").getTime();
  return isFinite(ms) ? ms : Date.now();
}

function CalendarScreen() {
  const { blocks } = useFocusLog();
  const [day, setDay] = useState<number>(() => startOfDay(Date.now()));

  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const dayBlocks = useMemo(
    () => blocks
      .filter((b) => b.end > dayStart && b.start < dayEnd)
      .sort((a, b) => a.start - b.start),
    [blocks, dayStart, dayEnd],
  );

  const totals = useMemo(() => {
    const t = { focus: 0, distraction: 0, neutral: 0 };
    for (const b of dayBlocks) {
      const s = Math.max(b.start, dayStart);
      const e = Math.min(b.end, dayEnd);
      if (e > s) t[b.type] += e - s;
    }
    return t;
  }, [dayBlocks, dayStart, dayEnd]);

  const shift = (delta: number) => setDay((d) => startOfDay(d + delta * 86400000));

  const dateLabel = new Date(day).toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Calendar</div>
      </div>

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">{dateLabel}</h1>
          <p className="text-sm text-muted-foreground">Hour-by-hour view of your timeline.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDay(startOfDay(Date.now() - 86400000))}>Yesterday</Button>
          <Button variant="outline" size="sm" onClick={() => setDay(startOfDay(Date.now()))}>Today</Button>
          <div className="flex items-end gap-1">
            <div className="space-y-1">
              <Label htmlFor="cal-date" className="text-[10px] uppercase tracking-wider text-muted-foreground">Pick date</Label>
              <Input
                id="cal-date"
                type="date"
                value={toDateInput(day)}
                onChange={(e) => setDay(fromDateInput(e.target.value))}
                className="h-9 w-[160px]"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Focus" value={fmtDuration(totals.focus)} dot="bg-focus" />
        <Stat label="Distraction" value={fmtDuration(totals.distraction)} dot="bg-distraction" />
        <Stat label="Neutral" value={fmtDuration(totals.neutral)} dot="bg-neutral" />
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 md:p-6">
        <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Daily timeline</div>
        <HourGantt blocks={dayBlocks} dayStart={dayStart} />
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground md:px-6">
          Entries ({dayBlocks.length})
        </div>
        {dayBlocks.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground md:px-6">No entries logged on this day.</div>
        ) : (
          <ul className="divide-y divide-border">
            {dayBlocks.map((b) => <EntryRow key={b.id} block={b} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EntryRow({ block }: { block: TimeBlock }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 md:px-6">
      <span className={
        block.type === "focus" ? "h-2 w-2 rounded-full bg-focus"
        : block.type === "distraction" ? "h-2 w-2 rounded-full bg-distraction"
        : "h-2 w-2 rounded-full bg-neutral"
      } />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{block.categoryName}{block.isBreak ? " (break)" : ""}</div>
        {block.note && <div className="truncate text-[11px] text-muted-foreground">{block.note}</div>}
      </div>
      <div className="tabular-nums text-xs text-muted-foreground">
        {fmtClock(block.start)} – {fmtClock(block.end)} · {fmtDuration(block.end - block.start)}
      </div>
    </li>
  );
}
