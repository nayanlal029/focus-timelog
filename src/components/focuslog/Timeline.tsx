import { useState } from "react";
import { useFocusLog } from "@/lib/focuslog/context";
import { fmtClock, fmtDuration } from "@/lib/focuslog/format";
import type { TimeBlock } from "@/lib/focuslog/types";
import { typePillClasses } from "./typeStyles";
import { cn } from "@/lib/utils";
import { EditBlockSheet } from "./Sheets";

export function Timeline({ blocks, emptyLabel = "No activity logged yet." }: { blocks: TimeBlock[]; emptyLabel?: string }) {
  const [editing, setEditing] = useState<TimeBlock | null>(null);
  const sorted = [...blocks].sort((a, b) => b.start - a.start);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  return (
    <>
      <ul className="space-y-2">
        {sorted.map((b) => {
          const dur = b.end - b.start;
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setEditing(b)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-left transition-transform active:scale-[0.99]",
                  typePillClasses(b.type),
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{b.categoryName}</div>
                    <div className="mt-0.5 text-xs opacity-80 tabular-nums">
                      {fmtClock(b.start)} – {fmtClock(b.end)}
                    </div>
                    {b.note && <div className="mt-1 truncate text-xs opacity-90">{b.note}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold tabular-nums">{fmtDuration(dur)}</div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <EditBlockSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} block={editing} />
    </>
  );
}
