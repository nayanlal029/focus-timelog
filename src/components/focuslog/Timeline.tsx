import { useEffect, useState } from "react";
import { Trash2, CheckSquare, Square as SquareIcon, X } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { fmtClock, fmtDuration, haptic } from "@/lib/focuslog/format";
import type { TimeBlock } from "@/lib/focuslog/types";
import { typePillClasses } from "./typeStyles";
import { cn } from "@/lib/utils";
import { EditBlockSheet } from "./Sheets";

const PAGE_SIZE = 20;

export function Timeline({ blocks, emptyLabel = "No activity logged yet.", pageSize = PAGE_SIZE }: { blocks: TimeBlock[]; emptyLabel?: string; pageSize?: number }) {
  const { deleteBlock } = useFocusLog();
  const [editing, setEditing] = useState<TimeBlock | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sorted = [...blocks].sort((a, b) => b.start - a.start);
  const visible = sorted.slice(0, visibleCount);

  // reset pagination when blocks list identity/length changes
  useEffect(() => { setVisibleCount(pageSize); }, [blocks, pageSize]);

  // exit select mode when no items
  useEffect(() => { if (sorted.length === 0 && selectMode) setSelectMode(false); }, [sorted.length, selectMode]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const deleteSelected = () => {
    haptic(20);
    selected.forEach((id) => deleteBlock(id));
    exitSelect();
  };

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        {selectMode ? (
          <>
            <button
              type="button"
              onClick={exitSelect}
              className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <button
                type="button"
                onClick={deleteSelected}
                disabled={selected.size === 0}
                className="flex items-center gap-1 rounded-full bg-distraction px-3 py-1 text-xs font-semibold text-distraction-foreground disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <span />
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
            >
              <CheckSquare className="h-3.5 w-3.5" /> Select
            </button>
          </>
        )}
      </div>

      <ul className="space-y-2">
        {visible.map((b) => {
          const dur = b.end - b.start;
          const isSel = selected.has(b.id);
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => selectMode ? toggle(b.id) : setEditing(b)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-left transition-transform active:scale-[0.99]",
                  typePillClasses(b.type),
                  selectMode && isSel && "ring-2 ring-accent",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  {selectMode && (
                    <span className="shrink-0">
                      {isSel
                        ? <CheckSquare className="h-5 w-5 text-accent" />
                        : <SquareIcon className="h-5 w-5 opacity-50" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
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
      {sorted.length > visibleCount && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground tabular-nums">
            Showing {visible.length} of {sorted.length}
          </span>
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + pageSize)}
            className="rounded-full border border-border bg-card px-3 py-1.5 font-medium text-foreground"
          >
            Load more
          </button>
        </div>
      )}
      <EditBlockSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} block={editing} />
    </>
  );
}
