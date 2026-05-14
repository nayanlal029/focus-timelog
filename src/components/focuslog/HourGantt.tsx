import { useMemo } from "react";
import type { TimeBlock } from "@/lib/focuslog/types";
import { cn } from "@/lib/utils";
import { fmtDuration } from "@/lib/focuslog/format";

interface Props {
  blocks: TimeBlock[];
  /** Day to render. If omitted uses the day of the first block, else today. */
  dayStart?: number;
}

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function colorFor(type: TimeBlock["type"]) {
  if (type === "focus") return "bg-focus";
  if (type === "distraction") return "bg-distraction";
  return "bg-neutral";
}

export function HourGantt({ blocks, dayStart }: Props) {
  const start = useMemo(() => {
    const ms = dayStart ?? blocks[0]?.start ?? Date.now();
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [dayStart, blocks]);
  const end = start + 24 * 3600 * 1000;

  const segments = useMemo(() => {
    const dayMs = end - start;
    return blocks
      .map((b) => {
        const s = Math.max(b.start, start);
        const e = Math.min(b.end, end);
        if (e <= s) return null;
        return {
          id: b.id,
          left: ((s - start) / dayMs) * 100,
          width: ((e - s) / dayMs) * 100,
          type: b.type,
          name: b.categoryName,
          dur: e - s,
        };
      })
      .filter(Boolean) as Array<{ id: string; left: number; width: number; type: TimeBlock["type"]; name: string; dur: number }>;
  }, [blocks, start, end]);

  return (
    <div className="space-y-1.5">
      <div className="relative h-9 overflow-hidden rounded-xl border border-border bg-card">
        {/* hour grid */}
        {HOURS.slice(1, -1).map((h) => (
          <div
            key={h}
            className="absolute top-0 h-full w-px bg-border/60"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}
        {segments.map((s) => (
          <div
            key={s.id}
            title={`${s.name} · ${fmtDuration(s.dur)}`}
            className={cn("absolute top-1 bottom-1 rounded-md", colorFor(s.type))}
            style={{ left: `${s.left}%`, width: `max(2px, ${s.width}%)` }}
          />
        ))}
      </div>
      <div className="flex justify-between px-0.5 text-[9px] tabular-nums text-muted-foreground">
        {HOURS.map((h) => <span key={h}>{h.toString().padStart(2, "0")}</span>)}
      </div>
    </div>
  );
}
