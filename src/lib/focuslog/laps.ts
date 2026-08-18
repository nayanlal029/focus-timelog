export interface Lap {
  id: string;
  index: number;
  ms: number;
  endedAt: number;
}

export interface LapState {
  laps: Lap[];
  /** epoch ms when the current lap resumed, or null when paused. */
  runningSince: number | null;
  /** accumulated ms of the current (in-progress) lap while paused. */
  accumulatedMs: number;
}

const KEY = "focuslog.laps.v1";

export const emptyLapState: LapState = { laps: [], runningSince: null, accumulatedMs: 0 };

export function loadLaps(): LapState {
  if (typeof localStorage === "undefined") return emptyLapState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyLapState;
    const parsed = JSON.parse(raw) as LapState;
    if (!parsed || !Array.isArray(parsed.laps)) return emptyLapState;
    return {
      laps: parsed.laps,
      runningSince: typeof parsed.runningSince === "number" ? parsed.runningSince : null,
      accumulatedMs: typeof parsed.accumulatedMs === "number" ? parsed.accumulatedMs : 0,
    };
  } catch {
    return emptyLapState;
  }
}

export function saveLaps(state: LapState) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearLaps() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function currentLapMs(state: LapState, now: number): number {
  return state.accumulatedMs + (state.runningSince ? now - state.runningSince : 0);
}

/** mm:ss.d — compact sub-task precision. */
export function fmtLap(ms: number): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const t = Math.floor((total % 1000) / 100);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}.${t}`;
}
