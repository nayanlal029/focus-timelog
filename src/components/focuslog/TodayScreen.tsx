import { useState } from "react";
import { Pause, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusLog } from "@/lib/focuslog/context";
import { fmtHMS, haptic, dayKey } from "@/lib/focuslog/format";
import { ChipRow } from "@/components/focuslog/ChipRow";
import { BreakPopup } from "@/components/focuslog/BreakPopup";
import { CategoryDialog } from "@/components/focuslog/CategoryDialog";
import { AddPastActivitySheet, SaveActivitySheet } from "@/components/focuslog/Sheets";
import { Timeline } from "@/components/focuslog/Timeline";

export function TodayScreen() {
  const {
    active, blocks, computeActiveMs, getCategory,
    startActivity, pauseActivity, resumeActivity, stopActivity, cancelActivity,
  } = useFocusLog();

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draft, setDraft] = useState<null | { categoryId: string; categoryName: string; start: number; end: number; activeMs: number }>(null);

  const todayKey = dayKey(Date.now());
  const todayBlocks = blocks.filter((b) => dayKey(b.start) === todayKey);

  const activeMs = computeActiveMs();
  const activeCat = active ? getCategory(active.categoryId) : null;
  const isPaused = !!active && active.runningSince === null;

  const handleStart = (id: string) => {
    if (active) return;
    haptic(10);
    startActivity(id);
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
        <div className="text-[64px] font-bold leading-none tabular-nums tracking-tight sm:text-[72px]">
          {fmtHMS(activeMs)}
        </div>
        <div className="mt-3 h-6 text-sm font-medium text-muted-foreground">
          {activeCat ? (
            <span className="inline-flex items-center gap-2">
              <span className={
                activeCat.type === "focus" ? "h-2 w-2 rounded-full bg-focus"
                : activeCat.type === "distraction" ? "h-2 w-2 rounded-full bg-distraction"
                : "h-2 w-2 rounded-full bg-neutral"
              } />
              {activeCat.name}
            </span>
          ) : (
            <span className="text-muted-foreground/70">Tap a chip to start</span>
          )}
        </div>

        <div className="mt-4 h-12">
          {active && !isPaused && (
            <Button
              size="lg"
              className="h-12 rounded-full px-8 text-base"
              onClick={handlePause}
            >
              <Pause className="h-5 w-5" /> Pause
            </Button>
          )}
          {active && isPaused && (
            <Button
              size="lg"
              className="h-12 rounded-full px-8 text-base"
              onClick={handleResume}
            >
              <Play className="h-5 w-5" /> Resume
            </Button>
          )}
        </div>
      </section>

      <section>
        <ChipRow
          activeId={active?.categoryId ?? null}
          disabledStart={!!active}
          onPick={handleStart}
          onAddNew={() => setAddCatOpen(true)}
        />
      </section>

      <section className="space-y-3 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Timeline</h2>
          <span className="text-xs text-muted-foreground">{todayBlocks.length} entries</span>
        </div>
        <Timeline blocks={todayBlocks} emptyLabel="Tap a chip above to start logging." />
      </section>

      <BreakPopup open={!!active && isPaused && !saveOpen} onResume={handleResume} onStop={handleStop} />
      <SaveActivitySheet open={saveOpen} onOpenChange={setSaveOpen} draft={draft} onSave={handleSave} onDiscard={handleDiscard} />
      <CategoryDialog open={addCatOpen} onOpenChange={setAddCatOpen} />
      <AddPastActivitySheet open={pastOpen} onOpenChange={setPastOpen} />
    </div>
  );
}
