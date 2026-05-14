import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Plus, Square } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { fmtHMS, haptic, dayKey } from "@/lib/focuslog/format";
import { ChipRow } from "@/components/focuslog/ChipRow";
import { CategoryDialog } from "@/components/focuslog/CategoryDialog";
import { AddPastActivitySheet, SaveActivitySheet } from "@/components/focuslog/Sheets";
import { Timeline } from "@/components/focuslog/Timeline";
import { cn } from "@/lib/utils";

export function TodayScreen() {
  const {
    categories, active, blocks, computeActiveMs, getCategory,
    startActivity, pauseActivity, resumeActivity, stopActivity, cancelActivity,
  } = useFocusLog();

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draft, setDraft] = useState<null | { categoryId: string; categoryName: string; start: number; end: number; activeMs: number }>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // pick a sensible default selected category (most recently used) when none chosen
  const defaultId = useMemo(() => {
    if (active) return active.categoryId;
    const lastUsed = new Map<string, number>();
    for (const b of blocks) {
      if (b.isBreak) continue;
      const prev = lastUsed.get(b.categoryId) ?? 0;
      if (b.start > prev) lastUsed.set(b.categoryId, b.start);
    }
    let bestId: string | null = null;
    let bestT = -1;
    for (const [id, t] of lastUsed) {
      if (t > bestT) { bestT = t; bestId = id; }
    }
    return bestId ?? categories[0]?.id ?? null;
  }, [active, blocks, categories]);

  useEffect(() => {
    if (active) { setSelectedId(active.categoryId); return; }
    if (!selectedId && defaultId) setSelectedId(defaultId);
  }, [active, defaultId, selectedId]);

  const todayKey = dayKey(Date.now());
  const todayBlocks = blocks.filter((b) => dayKey(b.start) === todayKey);

  const activeMs = computeActiveMs();
  const activeCat = active ? getCategory(active.categoryId) : null;
  const selectedCat = selectedId ? getCategory(selectedId) : null;
  const isPaused = !!active && active.runningSince === null;

  const handlePlay = () => {
    if (active) return;
    if (!selectedId) return;
    haptic(12);
    startActivity(selectedId);
  };
  const handlePause = () => { haptic(15); pauseActivity(); };
  const handleResume = () => { haptic(10); resumeActivity(); };

  const handleStop = () => {
    if (!active || !activeCat) return;
    haptic(20);
    const now = Date.now();
    let totalActive = active.accumulatedMs;
    if (active.runningSince) totalActive += now - active.runningSince;
    const endTime = active.breakStartedAt ?? now;
    setDraft({
      categoryId: activeCat.id,
      categoryName: activeCat.name,
      start: active.startedAt,
      end: endTime,
      activeMs: totalActive,
    });
    setSaveOpen(true);
  };

  const handleSave = (note: string) => {
    stopActivity(note);
    setSaveOpen(false);
    setDraft(null);
  };
  const handleDiscard = () => {
    cancelActivity();
    setSaveOpen(false);
    setDraft(null);
  };

  const dotClass = (cat: typeof selectedCat) => cn(
    "h-2 w-2 rounded-full",
    cat?.type === "focus" && "bg-focus",
    cat?.type === "distraction" && "bg-distraction",
    cat?.type === "neutral" && "bg-neutral",
  );

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Today</div>
          <h1 className="text-2xl font-semibold leading-tight">
            {new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setPastOpen(true)}
          className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Past
        </button>
      </header>

      <section className="flex flex-col items-center pt-2">
        <div className="mb-3 h-6 text-sm font-medium">
          {active ? (
            <span className="inline-flex items-center gap-2 text-foreground">
              <span className={dotClass(activeCat)} />
              {activeCat?.name}
              {isPaused && <span className="text-muted-foreground">· paused</span>}
            </span>
          ) : selectedCat ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span className={dotClass(selectedCat)} />
              {selectedCat.name}
            </span>
          ) : (
            <span className="text-muted-foreground/70">Pick a category below</span>
          )}
        </div>

        {!active ? (
          <button
            type="button"
            onClick={handlePlay}
            disabled={!selectedId}
            aria-label="Start"
            className={cn(
              "relative flex h-56 w-56 items-center justify-center rounded-full",
              "bg-accent text-accent-foreground shadow-[0_10px_60px_-10px_oklch(0.36_0.07_252_/_0.6)]",
              "transition-transform active:scale-95 disabled:opacity-40",
              "ring-1 ring-accent/40",
            )}
          >
            <span className="absolute inset-2 rounded-full ring-1 ring-accent-foreground/20" />
            <Play className="h-20 w-20 translate-x-1 fill-current" strokeWidth={1.5} />
          </button>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div className={cn(
              "flex h-56 w-56 flex-col items-center justify-center rounded-full border-2",
              isPaused ? "border-muted-foreground/40" : "border-accent",
              "bg-card",
            )}>
              <div className="text-[44px] font-bold leading-none tabular-nums tracking-tight">
                {fmtHMS(activeMs)}
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {isPaused ? "Paused" : "Running"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isPaused ? (
                <button
                  type="button"
                  onClick={handleResume}
                  className="flex h-14 items-center gap-2 rounded-full bg-accent px-7 text-base font-semibold text-accent-foreground shadow-md active:scale-95"
                >
                  <Play className="h-5 w-5 fill-current" /> Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="flex h-14 items-center gap-2 rounded-full bg-card px-7 text-base font-semibold text-foreground border border-border active:scale-95"
                >
                  <Pause className="h-5 w-5" /> Pause
                </button>
              )}
              <button
                type="button"
                onClick={handleStop}
                className="flex h-14 items-center gap-2 rounded-full bg-distraction/15 px-7 text-base font-semibold text-distraction border border-distraction/40 active:scale-95"
              >
                <Square className="h-5 w-5 fill-current" /> Stop
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {active ? "Active" : "Choose category"}
          </h2>
          <span className="text-[11px] text-muted-foreground">Recent first</span>
        </div>
        <ChipRow
          selectedId={selectedId}
          activeId={active?.categoryId ?? null}
          disabled={!!active}
          onPick={(id) => { if (!active) setSelectedId(id); }}
          onAddNew={() => setAddCatOpen(true)}
        />
      </section>

      <section className="space-y-3 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Timeline</h2>
          <span className="text-xs text-muted-foreground">{todayBlocks.length} entries · tap to edit</span>
        </div>
        <Timeline blocks={todayBlocks} emptyLabel="Pick a category and tap Play to start logging." />
      </section>

      <SaveActivitySheet open={saveOpen} onOpenChange={setSaveOpen} draft={draft} onSave={handleSave} onDiscard={handleDiscard} />
      <CategoryDialog open={addCatOpen} onOpenChange={setAddCatOpen} />
      <AddPastActivitySheet open={pastOpen} onOpenChange={setPastOpen} />
    </div>
  );
}
