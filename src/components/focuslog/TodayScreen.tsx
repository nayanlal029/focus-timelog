import { useEffect, useMemo, useState } from "react";
import { Play, Plus, Search, X, Timer as TimerIcon } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { haptic, dayKey } from "@/lib/focuslog/format";
import { ChipRow } from "@/components/focuslog/ChipRow";
import { CategoryDialog } from "@/components/focuslog/CategoryDialog";
import { AddPastActivitySheet, SaveActivitySheet } from "@/components/focuslog/Sheets";
import { Timeline } from "@/components/focuslog/Timeline";
import { FocusMode } from "@/components/focuslog/FocusMode";
import { Switch } from "@/components/ui/switch";
import {
  loadPomodoro, savePomodoro, loadReminder, saveReminder, useTimerAlerts,
  type PomodoroConfig, type ReminderConfig,
} from "@/lib/focuslog/alerts";
import { cn } from "@/lib/utils";

export function TodayScreen() {
  const {
    categories, active, blocks, computeActiveMs, computeBreakMs, getCategory,
    startActivity, pauseActivity, resumeActivity, stopActivity, cancelActivity,
  } = useFocusLog();

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draft, setDraft] = useState<null | { categoryId: string; categoryName: string; start: number; end: number; activeMs: number }>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Pomodoro config (mirrored to localStorage).
  const [pomo, setPomo] = useState<PomodoroConfig>(() => loadPomodoro());
  useEffect(() => { savePomodoro(pomo); }, [pomo]);

  // Recurring reminder config (buzz every N min focus / break).
  const [reminder, setReminder] = useState<ReminderConfig>(() => loadReminder());
  useEffect(() => { saveReminder(reminder); }, [reminder]);

  // Schedules pomodoro + escalating pause alerts.
  useTimerAlerts(active);

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
    if (active || !selectedId) return;
    haptic(12);
    setNoteDraft("");
    startActivity(selectedId);
  };

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
    setNoteDraft("");
  };
  const handleDiscard = () => {
    cancelActivity();
    setSaveOpen(false);
    setDraft(null);
    setNoteDraft("");
  };

  const dotClass = (cat: typeof selectedCat) => cn(
    "h-2 w-2 rounded-full",
    cat?.type === "focus" && "bg-focus",
    cat?.type === "distraction" && "bg-distraction",
    cat?.type === "neutral" && "bg-neutral",
  );

  return (
    <>
      <div className="flex flex-col gap-6 px-4 pt-6">
        <header className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Today</div>
            <h1 className="text-xl sm:text-2xl font-semibold leading-tight">
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
            {selectedCat ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span className={dotClass(selectedCat)} />
                {selectedCat.name}
              </span>
            ) : (
              <span className="text-muted-foreground/70">Pick a category below</span>
            )}
          </div>

          <button
            type="button"
            onClick={handlePlay}
            disabled={!selectedId}
            aria-label="Start"
            className={cn(
              "relative flex items-center justify-center rounded-full",
              "h-44 w-44 sm:h-56 sm:w-56",
              "bg-accent text-accent-foreground shadow-[0_10px_60px_-10px_oklch(0.36_0.07_252_/_0.6)]",
              "transition-transform active:scale-95 disabled:opacity-40",
              "ring-1 ring-accent/40",
            )}
          >
            <span className="absolute inset-2 rounded-full ring-1 ring-accent-foreground/20" />
            <Play className="h-16 w-16 sm:h-20 sm:w-20 translate-x-1 fill-current" strokeWidth={1.5} />
          </button>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Choose category</h2>
            <button
              type="button"
              onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch(""); }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                searchOpen ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground",
              )}
              aria-label="Search categories"
            >
              {searchOpen ? <X className="h-3 w-3" /> : <Search className="h-3 w-3" />}
              {searchOpen ? "Close" : "Search"}
            </button>
          </div>
          {searchOpen && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter categories…"
                className="h-9 w-full rounded-full border border-border bg-card pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <ChipRow
            selectedId={selectedId}
            activeId={null}
            filter={search}
            onPick={(id) => setSelectedId(id)}
            onAddNew={() => setAddCatOpen(true)}
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TimerIcon className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">Pomodoro</div>
                <div className="text-[11px] text-muted-foreground">{pomo.workMin}m focus · {pomo.breakMin}m break</div>
              </div>
            </div>
            <Switch
              checked={pomo.enabled}
              onCheckedChange={(c) => setPomo((p) => ({ ...p, enabled: c }))}
              aria-label="Enable Pomodoro"
            />
          </div>
          {pomo.enabled && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Work (min)</span>
                <input
                  type="number" min={1} max={120}
                  value={pomo.workMin}
                  onChange={(e) => setPomo((p) => ({ ...p, workMin: Math.min(120, Math.max(1, Number(e.target.value) || 1)) }))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Break (min)</span>
                <input
                  type="number" min={1} max={120}
                  value={pomo.breakMin}
                  onChange={(e) => setPomo((p) => ({ ...p, breakMin: Math.min(120, Math.max(1, Number(e.target.value) || 1)) }))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TimerIcon className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">Reminders</div>
                <div className="text-[11px] text-muted-foreground">
                  Buzz every {reminder.focusEveryMin}m focus · {reminder.breakEveryMin}m break
                </div>
              </div>
            </div>
            <Switch
              checked={reminder.enabled}
              onCheckedChange={(c) => setReminder((r) => ({ ...r, enabled: c }))}
              aria-label="Enable reminders"
            />
          </div>
          {reminder.enabled && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Focus every (min)</span>
                <input
                  type="number" min={1} max={120}
                  value={reminder.focusEveryMin}
                  onChange={(e) => setReminder((r) => ({ ...r, focusEveryMin: Math.min(120, Math.max(1, Number(e.target.value) || 1)) }))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Break every (min)</span>
                <input
                  type="number" min={1} max={120}
                  value={reminder.breakEveryMin}
                  onChange={(e) => setReminder((r) => ({ ...r, breakEveryMin: Math.min(120, Math.max(1, Number(e.target.value) || 1)) }))}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </label>
            </div>
          )}
        </section>

        <section className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Timeline</h2>
            <span className="text-xs text-muted-foreground">{todayBlocks.length} entries · tap to edit</span>
          </div>
          <Timeline blocks={todayBlocks} emptyLabel="Pick a category and tap Play to start logging." />
        </section>

        <SaveActivitySheet
          open={saveOpen}
          onOpenChange={setSaveOpen}
          draft={draft}
          initialNote={noteDraft}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />
        <CategoryDialog open={addCatOpen} onOpenChange={setAddCatOpen} />
        <AddPastActivitySheet open={pastOpen} onOpenChange={setPastOpen} />
      </div>

      {active && activeCat && !saveOpen && (
        <FocusMode
          activeMs={activeMs}
          breakMs={computeBreakMs()}
          categoryName={activeCat.name}
          isPaused={isPaused}
          note={noteDraft}
          onNoteChange={setNoteDraft}
          onPause={pauseActivity}
          onResume={resumeActivity}
          onStop={handleStop}
        />
      )}
    </>
  );
}
