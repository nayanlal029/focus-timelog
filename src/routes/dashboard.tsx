import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useFocusLog } from "@/lib/focuslog/context";
import { dayKey, fmtDuration, startOfDay } from "@/lib/focuslog/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "FocusLog — Dashboard" }] }),
  component: DashboardScreen,
});

function DashboardScreen() {
  const { blocks } = useFocusLog();
  const today = startOfDay(Date.now());

  const todayBlocks = blocks.filter((b) => dayKey(b.start) === dayKey(today));
  const todayTotals = sumByType(todayBlocks);

  const week = useMemo(() => {
    const days: { label: string; key: string; focus: number; distraction: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const k = dayKey(d.getTime());
      const dayBlocks = blocks.filter((b) => dayKey(b.start) === k);
      const t = sumByType(dayBlocks);
      days.push({
        label: d.toLocaleDateString([], { weekday: "narrow" }),
        key: k,
        focus: t.focus,
        distraction: t.distraction,
      });
    }
    return days;
  }, [blocks, today]);

  const maxBar = Math.max(1, ...week.map((d) => Math.max(d.focus, d.distraction)));

  const last7 = blocks.filter((b) => b.start >= today - 6 * 24 * 3600 * 1000);
  const topFocus = topByCategory(last7.filter((b) => b.type === "focus")).slice(0, 3);
  const topDistr = topByCategory(last7.filter((b) => b.type === "distraction")).slice(0, 3);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Dashboard</div>
        <h1 className="mt-1 text-2xl font-semibold">Today's totals</h1>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Focus" value={todayTotals.focus} tone="focus" />
        <StatCard label="Distraction" value={todayTotals.distraction} tone="distraction" />
        <StatCard label="Neutral" value={todayTotals.neutral} tone="neutral" />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Last 7 days</h2>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-focus" /> Focus</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-distraction" /> Distraction</span>
          </div>
        </div>
        <div className="flex h-40 items-end justify-between gap-1.5">
          {week.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-32 w-full items-end gap-0.5">
                <div
                  className="flex-1 rounded-t-md bg-focus/80"
                  style={{ height: `${(d.focus / maxBar) * 100}%` }}
                />
                <div
                  className="flex-1 rounded-t-md bg-distraction/80"
                  style={{ height: `${(d.distraction / maxBar) * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{d.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <TopList title="Top Focus (7d)" items={topFocus} tone="focus" />
        <TopList title="Top Distraction (7d)" items={topDistr} tone="distraction" />
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

function TopList({ title, items, tone }: { title: string; items: { name: string; ms: number }[]; tone: "focus" | "distraction" }) {
  const dot = tone === "focus" ? "bg-focus" : "bg-distraction";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No data yet.</div>
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
