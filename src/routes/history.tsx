import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { dayKey, fmtDuration } from "@/lib/focuslog/format";
import { Timeline } from "@/components/focuslog/Timeline";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "FocusLog — History" }] }),
  component: HistoryScreen,
});

function HistoryScreen() {
  const { blocks } = useFocusLog();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(dayKey(today.getTime()));

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

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">History</div>
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
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelected(c.key)}
                className={cn(
                  "relative aspect-square rounded-xl border text-sm font-medium transition-colors",
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card text-foreground/85",
                  isToday && !isSelected && "ring-1 ring-accent/60",
                )}
              >
                <span>{c.day}</span>
                {data && (
                  <span className="absolute inset-x-1.5 bottom-1 flex justify-center gap-0.5">
                    {data.focus > 0 && <span className="h-1 w-1 rounded-full bg-focus" />}
                    {data.distraction > 0 && <span className="h-1 w-1 rounded-full bg-distraction" />}
                    {data.neutral > 0 && <span className="h-1 w-1 rounded-full bg-neutral" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            {new Date(selected + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
          </h2>
          {summary && (
            <span className="text-xs text-muted-foreground tabular-nums">
              <span className="text-focus">{fmtDuration(summary.focus)}</span>
              {" · "}
              <span className="text-distraction">{fmtDuration(summary.distraction)}</span>
            </span>
          )}
        </div>
        <Timeline blocks={dayBlocks} emptyLabel="Nothing logged on this day." />
      </div>
    </div>
  );
}
