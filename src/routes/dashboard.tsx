import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, X } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { useFilter } from "@/lib/focuslog/filter-context";
import { dayKey, fmtDuration } from "@/lib/focuslog/format";
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

  const filtered = useMemo(() => {
    if (!range) return [];
    return blocks.filter((b) => b.start >= range.start && b.start <= range.end);
  }, [blocks, range]);

  const totals = useMemo(() => sumByType(filtered), [filtered]);

  // bucket per day across selected range
  const days = useMemo(() => {
    if (!range) return [];
    const out: { label: string; key: string; focus: number; distraction: number; neutral: number }[] = [];
    const start = new Date(range.start); start.setHours(0, 0, 0, 0);
    const end = new Date(range.end); end.setHours(0, 0, 0, 0);
    const oneDay = 86400000;
    const dayCount = Math.min(60, Math.floor((end.getTime() - start.getTime()) / oneDay) + 1);
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(start.getTime() + i * oneDay);
      const k = dayKey(d.getTime());
      const dayBlocks = filtered.filter((b) => dayKey(b.start) === k);
      const t = sumByType(dayBlocks);
      out.push({
        label: dayCount <= 14
          ? d.toLocaleDateString([], { weekday: "narrow" })
          : String(d.getDate()),
        key: k,
        focus: t.focus,
        distraction: t.distraction,
        neutral: t.neutral,
      });
    }
    return out;
  }, [range, filtered]);

  const maxBar = Math.max(1, ...days.map((d) => Math.max(d.focus, d.distraction)));

  const topFocus = topByCategory(filtered.filter((b) => b.type === "focus")).slice(0, 5);
  const topDistr = topByCategory(filtered.filter((b) => b.type === "distraction")).slice(0, 5);

  const sessionCount = filtered.length;
  const totalMs = totals.focus + totals.distraction + totals.neutral;
  const focusPct = totalMs > 0 ? Math.round((totals.focus / totalMs) * 100) : 0;
  const avgSessionMs = sessionCount > 0 ? Math.round(totalMs / sessionCount) : 0;

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
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

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Sessions" value={String(sessionCount)} />
        <MiniStat label="Focus %" value={`${focusPct}%`} />
        <MiniStat label="Avg session" value={fmtDuration(avgSessionMs)} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Range breakdown</h2>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-focus" /> Focus</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-distraction" /> Distraction</span>
          </div>
        </div>
        {days.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Pick a date range to see a breakdown.</div>
        ) : (
          <div className="flex h-40 items-end justify-between gap-1">
            {days.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-32 w-full items-end gap-0.5">
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
  );
}

function sumByType(bs: { type: "focus" | "distraction" | "neutral"; start: number; end: number }[]) {
  const out = { focus: 0, distraction: 0, neutral: 0 };
  bs.forEach((b) => { out[b.type] += b.end - b.start; });
  return out;
}

function topByCategory(bs: { categoryName: string; start: number; end: number }[]) {
  const map = new Map<string, number>();
  bs.forEach((b) => map.set(b.categoryName, (map.get(b.categoryName) ?? 0) + (b.end - b.start)));
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, ms]) => ({ name, ms }));
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
