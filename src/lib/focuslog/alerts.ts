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

export interface ReminderConfig {
  enabled: boolean;
  focusEveryMin: number; // buzz every N min while focusing
  breakEveryMin: number; // buzz every N min while paused/distracted
}

export const POMODORO_KEY = "focuslog.pomodoro";
export const PAUSE_ALERTS_KEY = "focuslog.alerts.pause";
export const REMINDER_KEY = "focuslog.alerts.reminder";

export const DEFAULT_POMODORO: PomodoroConfig = { enabled: false, workMin: 25, breakMin: 5 };
export const DEFAULT_REMINDER: ReminderConfig = { enabled: true, focusEveryMin: 10, breakEveryMin: 5 };

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

export function loadReminder(): ReminderConfig {
  if (typeof window === "undefined") return DEFAULT_REMINDER;
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (!raw) return DEFAULT_REMINDER;
    const p = JSON.parse(raw) as Partial<ReminderConfig>;
    return {
      enabled: p.enabled !== false,
      focusEveryMin: Math.min(120, Math.max(1, Number(p.focusEveryMin) || 10)),
      breakEveryMin: Math.min(120, Math.max(1, Number(p.breakEveryMin) || 5)),
    };
  } catch { return DEFAULT_REMINDER; }
}
export function saveReminder(c: ReminderConfig) {
  try { localStorage.setItem(REMINDER_KEY, JSON.stringify(c)); } catch { /* ignore */ }
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

/**
 * Schedules pomodoro work/break alerts, plus recurring focus/break reminders.
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

  // Recurring focus reminder — every N minutes while running.
  useEffect(() => {
    if (!active || !active.runningSince) return;
    let timer: number | null = null;
    const tick = () => {
      const cfg = loadReminder();
      if (!cfg.enabled) return;
      const everyMs = cfg.focusEveryMin * 60_000;
      const elapsed = Date.now() - active.runningSince!;
      const next = Math.ceil((elapsed + 1) / everyMs) * everyMs;
      const delay = next - elapsed;
      timer = window.setTimeout(() => {
        if (!loadReminder().enabled) return;
        haptic(25);
        beep({ freq: 700, count: 1 });
        const mins = Math.round(next / 60_000);
        toast("Still on track?", { description: `Focused ${mins} min` });
        tick();
      }, delay);
    };
    tick();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [active?.runningSince, active]);

  // Recurring break/distraction reminder — every N minutes while paused.
  useEffect(() => {
    if (!active || !active.breakStartedAt) return;
    let timer: number | null = null;
    const tick = () => {
      if (!loadPauseAlerts()) return;
      const cfg = loadReminder();
      if (!cfg.enabled) return;
      const everyMs = cfg.breakEveryMin * 60_000;
      const elapsed = Date.now() - active.breakStartedAt!;
      const next = Math.ceil((elapsed + 1) / everyMs) * everyMs;
      const delay = next - elapsed;
      timer = window.setTimeout(() => {
        if (!loadPauseAlerts() || !loadReminder().enabled) return;
        haptic(35);
        beep({ freq: 520, count: 2 });
        const mins = Math.round(next / 60_000);
        toast(`Paused for ${mins} min`, { description: "Tap Resume to get back" });
        tick();
      }, delay);
    };
    tick();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [active?.breakStartedAt, active]);
}
