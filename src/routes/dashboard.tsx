import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, X } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { useFilter } from "@/lib/focuslog/filter-context";
import { fmtDuration } from "@/lib/focuslog/format";
import { clipBlocks, sumByType, sessionStats, topByCategory, overlapMs, eachLocalDay } from "@/lib/focuslog/aggregate";
import { FilterPanel } from "@/components/focuslog/FilterPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "FocusLog — Dashboard" }] }),
  component: DashboardScreen,
});

function DashboardScreen() {
  const { blocks } = useFocusLog();
  const { range, from, to } = useFilter();
  const [filterOpen, setFilterOpen] = useState(false);

  const clipped = useMemo(() => {
    if (!range) return [];
    return clipBlocks(blocks, range.start, range.end);
  }, [blocks, range]);

  const totals = useMemo(() => sumByType(clipped), [clipped]);

  // Per-day buckets (calendar days, DST-safe); grouped per week for long ranges.
  const { buckets, perWeek } = useMemo(() => {
    type Bucket = { label: string; key: string; focus: number; distraction: number; date: Date };
    if (!range) return { buckets: [] as Bucket[], perWeek: false };
    const dayBuckets: Bucket[] = eachLocalDay(range.start, range.end).map(({ dayStart, dayEnd, date }) => {
      const wStart = Math.max(dayStart, range.start);
      const wEnd = Math.min(dayEnd, range.end);
      let focus = 0;
      let distraction = 0;
      for (const b of blocks) {
        const ms = overlapMs(b.start, b.end, wStart, wEnd);
        if (ms <= 0) continue;
        if (b.isBreak) continue;
        if (b.type === "focus") focus += ms;
        else if (b.type === "distraction") distraction += ms;
      }
      return {
        label: "",
        key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        focus,
        distraction,
        date,
      };
    });
    if (dayBuckets.length > 90) {
      const weeks: Bucket[] = [];
      for (let i = 0; i < dayBuckets.length; i += 7) {
        const chunk = dayBuckets.slice(i, i + 7);
        weeks.push({
          label: chunk[0].date.toLocaleDateString([], { day: "numeric", month: "short" }),
          key: chunk[0].key,
          focus: chunk.reduce((s, c) => s + c.focus, 0),
          distraction: chunk.reduce((s, c) => s + c.distraction, 0),
          date: chunk[0].date,
        });
      }
      return { buckets: weeks, perWeek: true };
    }
    for (const b of dayBuckets) {
      b.label = dayBuckets.length <= 14
        ? b.date.toLocaleDateString([], { weekday: "narrow" })
        : String(b.date.getDate());
    }
    return { buckets: dayBuckets, perWeek: false };
  }, [range, blocks]);

  const maxBar = Math.max(1, ...buckets.map((d) => Math.max(d.focus, d.distraction)));

  const topFocus = topByCategory(clipped.filter((c) => c.block.type === "focus")).slice(0, 5);
  const topDistr = topByCategory(clipped.filter((c) => c.block.type === "distraction")).slice(0, 5);

  const { count: sessionCount, avgMs: avgSessionMs } = useMemo(() => sessionStats(clipped), [clipped]);
  const totalMs = totals.focus + totals.distraction + totals.neutral;
  const focusPct = totalMs > 0 ? Math.round((totals.focus / totalMs) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 md:pt-10">
      <header>
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Dashboard</div>
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
        <h1 className="mt-1 text-2xl font-semibold">Totals</h1>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{from} → {to}</p>
      </header>

      {filterOpen && <FilterPanel />}

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Focus" value={totals.focus} tone="focus" />
        <StatCard label="Distraction" value={totals.distraction} tone="distraction" />
        <StatCard label="Neutral" value={totals.neutral} tone="neutral" />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MiniStat label="Sessions" value={String(sessionCount)} />
        <MiniStat label="Focus %" value={`${focusPct}%`} />
        <MiniStat label="Avg session" value={fmtDuration(avgSessionMs)} />
        <MiniStat label="Break" value={fmtDuration(totals.break)} />
      </div>

      {/* Desktop: chart takes 2/3 width with the top-lists in a side column */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start">
        <section className="rounded-2xl border border-border bg-card p-4 lg:col-span-2 lg:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Range breakdown</h2>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-focus" /> Focus</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-distraction" /> Distraction</span>
              {perWeek && <span>per week</span>}
            </div>
          </div>
          {buckets.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Pick a date range to see a breakdown.</div>
          ) : (
            <div className="flex h-40 items-end justify-between gap-1 lg:h-64">
              {buckets.map((d) => (
                <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-32 w-full items-end gap-0.5 lg:h-56">
                    <div className="flex-1 rounded-t-md bg-focus/80" style={{ height: `${(d.focus / maxBar) * 100}%` }} />
                    <div className="flex-1 rounded-t-md bg-distraction/80" style={{ height: `${(d.distraction / maxBar) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{d.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3">
          <TopList title="Top Focus" items={topFocus} tone="focus" />
          <TopList title="Top Distraction" items={topDistr} tone="distraction" />
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "focus" | "distraction" | "neutral" }) {
  const dot = tone === "focus" ? "bg-focus" : tone === "distraction" ? "bg-distraction" : "bg-neutral";
  const text = tone === "focus" ? "text-focus" : tone === "distraction" ? "text-distraction" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} /> {label}
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${text}`}>{fmtDuration(value)}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TopList({ title, items, tone }: { title: string; items: { name: string; ms: number }[]; tone: "focus" | "distraction" }) {
  const dot = tone === "focus" ? "bg-focus" : "bg-distraction";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No data in range.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={it.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 truncate">
                <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                <span className="truncate">{it.name}</span>
              </span>
              <span className="font-medium tabular-nums">{fmtDuration(it.ms)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
