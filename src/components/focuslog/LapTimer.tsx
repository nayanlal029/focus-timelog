import { useEffect, useRef, useState } from "react";
import { Play, Pause, Flag, Trash2, X } from "lucide-react";
import { haptic } from "@/lib/focuslog/format";
import {
  clearLaps, currentLapMs, fmtLap, loadLaps, saveLaps, type LapState,
} from "@/lib/focuslog/laps";
import { cn } from "@/lib/utils";

interface Props {
  /** Called only when the sub-timer is closed so the main timer resurfaces. */
  onClose: () => void;
}

export function LapTimer({ onClose }: Props) {
  const [state, setState] = useState<LapState>(() => loadLaps());
  const [now, setNow] = useState(() => Date.now());
  const startedOnce = useRef(false);

  // Auto-start on open when idle and nothing recorded yet.
  useEffect(() => {
    if (startedOnce.current) return;
    startedOnce.current = true;
    setState((s) => (s.runningSince ? s : { ...s, runningSince: Date.now() }));
  }, []);

  useEffect(() => { saveLaps(state); }, [state]);

  useEffect(() => {
    if (!state.runningSince) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [state.runningSince]);

  const running = state.runningSince !== null;
  const elapsed = currentLapMs(state, running ? now : 0);

  const play = () => {
    haptic(10);
    setState((s) => (s.runningSince ? s : { ...s, runningSince: Date.now() }));
    setNow(Date.now());
  };

  const pause = () => {
    haptic(12);
    const pausedState = state.runningSince
      ? { ...state, accumulatedMs: currentLapMs(state, Date.now()), runningSince: null }
      : state;

    saveLaps(pausedState);
    setState(pausedState);
    setNow(Date.now());
  };

  const close = () => {
    haptic(8);
    const pausedState = state.runningSince
      ? { ...state, accumulatedMs: currentLapMs(state, Date.now()), runningSince: null }
      : state;

    // Persist before unmounting so closing never leaves the sub-timer running.
    saveLaps(pausedState);
    onClose();
  };

  const lap = () => {
    haptic(18);
    const t = Date.now();
    setState((s) => {
      const ms = currentLapMs(s, t);
      if (ms < 200) return s;
      return {
        laps: [{ id: `${t}`, index: s.laps.length + 1, ms, endedAt: t }, ...s.laps],
        runningSince: s.runningSince ? t : null,
        accumulatedMs: 0,
      };
    });
    setNow(t);
  };

  const reset = () => {
    haptic(20);
    clearLaps();
    setState({ laps: [], runningSince: null, accumulatedMs: 0 });
  };

  const best = state.laps.length > 1 ? Math.min(...state.laps.map((l) => l.ms)) : null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border border-border bg-card/70 px-6 py-7 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Sub-task {state.laps.length + 1}
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Close lap timer"
          className="rounded-full border border-border p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className={cn(
          "font-bold tabular-nums leading-none tracking-tight text-[clamp(48px,13vw,84px)]",
          running ? "text-accent" : "text-muted-foreground",
        )}
      >
        {fmtLap(elapsed)}
      </div>

      <div className="flex items-center gap-3">
        {running ? (
          <button
            type="button"
            onClick={pause}
            className="flex h-12 items-center gap-2 rounded-full border border-border bg-background px-6 text-sm font-semibold active:scale-95"
          >
            <Pause className="h-4 w-4" /> Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={play}
            className="flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground active:scale-95"
          >
            <Play className="h-4 w-4 fill-current" /> Play
          </button>
        )}
        <button
          type="button"
          onClick={lap}
          disabled={elapsed < 200}
          className="flex h-12 items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-6 text-sm font-semibold text-accent active:scale-95 disabled:opacity-40"
        >
          <Flag className="h-4 w-4" /> Lap
        </button>
        {state.laps.length > 0 && (
          <button
            type="button"
            onClick={reset}
            aria-label="Clear laps"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted-foreground active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {state.laps.length > 0 && (
        <div className="max-h-48 w-full overflow-y-auto rounded-2xl border border-border/60 bg-background/40">
          {state.laps.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between border-b border-border/40 px-4 py-2 text-sm last:border-b-0"
            >
              <span className="text-muted-foreground">Lap {l.index}</span>
              <span
                className={cn(
                  "tabular-nums font-medium",
                  best !== null && l.ms === best ? "text-focus" : "text-foreground",
                )}
              >
                {fmtLap(l.ms)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
