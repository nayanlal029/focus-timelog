import { useEffect } from "react";
import { toast } from "sonner";
import { beep } from "./sound";
import { haptic } from "./format";
import type { ActiveState } from "./storage";

export interface PomodoroConfig {
  enabled: boolean;
  workMin: number;
  breakMin: number;
}

export const POMODORO_KEY = "focuslog.pomodoro";
export const PAUSE_ALERTS_KEY = "focuslog.alerts.pause";

export const DEFAULT_POMODORO: PomodoroConfig = { enabled: false, workMin: 25, breakMin: 5 };

export function loadPomodoro(): PomodoroConfig {
  if (typeof window === "undefined") return DEFAULT_POMODORO;
  try {
    const raw = localStorage.getItem(POMODORO_KEY);
    if (!raw) return DEFAULT_POMODORO;
    const p = JSON.parse(raw) as Partial<PomodoroConfig>;
    return {
      enabled: !!p.enabled,
      workMin: Math.min(120, Math.max(1, Number(p.workMin) || 25)),
      breakMin: Math.min(120, Math.max(1, Number(p.breakMin) || 5)),
    };
  } catch { return DEFAULT_POMODORO; }
}
export function savePomodoro(c: PomodoroConfig) {
  try { localStorage.setItem(POMODORO_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export function loadPauseAlerts(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(PAUSE_ALERTS_KEY);
    return raw === null ? true : raw === "1";
  } catch { return true; }
}
export function savePauseAlerts(on: boolean) {
  try { localStorage.setItem(PAUSE_ALERTS_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}

// Escalating distraction-pause milestones (minutes).
const PAUSE_MILESTONES_MIN = [5, 10, 15, 30, 60, 90];
function nextPauseMilestoneMin(elapsedMin: number): number {
  for (const m of PAUSE_MILESTONES_MIN) if (m > elapsedMin) return m;
  // After 90, every 30 min.
  const k = Math.floor((elapsedMin - 90) / 30) + 1;
  return 90 + k * 30;
}

/**
 * Schedules pomodoro work/break alerts and escalating pause alerts.
 * Reads localStorage live so settings changes take effect on next schedule.
 */
export function useTimerAlerts(active: ActiveState | null) {
  // Pomodoro work interval — fires once workMin after current run started.
  useEffect(() => {
    if (!active || !active.runningSince) return;
    const cfg = loadPomodoro();
    if (!cfg.enabled) return;
    const elapsed = Date.now() - active.runningSince;
    const target = cfg.workMin * 60_000;
    if (elapsed >= target) return;
    const t = window.setTimeout(() => {
      haptic(40);
      beep({ freq: 660, count: 2 });
      toast("Pomodoro: time for a break", { description: `Worked ${cfg.workMin} min` });
    }, target - elapsed);
    return () => window.clearTimeout(t);
  }, [active?.runningSince, active]);

  // Pomodoro break-over — fires breakMin after pause start.
  useEffect(() => {
    if (!active || !active.breakStartedAt) return;
    const cfg = loadPomodoro();
    if (!cfg.enabled) return;
    const elapsed = Date.now() - active.breakStartedAt;
    const target = cfg.breakMin * 60_000;
    if (elapsed >= target) return;
    const t = window.setTimeout(() => {
      haptic(60);
      beep({ freq: 880, count: 3 });
      toast("Break's over — back to focus", { description: `Rested ${cfg.breakMin} min` });
    }, target - elapsed);
    return () => window.clearTimeout(t);
  }, [active?.breakStartedAt, active]);

  // Escalating pause alerts at 5/10/15/30/60/90 min then every 30 min.
  useEffect(() => {
    if (!active || !active.breakStartedAt) return;
    let timer: number | null = null;
    const schedule = () => {
      if (!loadPauseAlerts()) return;
      const startedAt = active.breakStartedAt!;
      const elapsedMin = (Date.now() - startedAt) / 60_000;
      const nextMin = nextPauseMilestoneMin(elapsedMin);
      const delay = nextMin * 60_000 - (Date.now() - startedAt);
      if (delay <= 0) return;
      timer = window.setTimeout(() => {
        haptic(30);
        beep({ freq: 520, count: 1 });
        toast(`Paused for ${nextMin} min`, { description: "Tap Resume to get back" });
        schedule();
      }, delay);
    };
    schedule();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [active?.breakStartedAt, active]);
}
