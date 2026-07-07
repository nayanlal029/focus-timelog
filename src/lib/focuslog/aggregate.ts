import type { TimeBlock } from "./types";

/** Returns overlap (in ms) between [bStart,bEnd) and [rStart,rEnd). 0 if none. */
export function overlapMs(bStart: number, bEnd: number, rStart: number, rEnd: number): number {
  const s = Math.max(bStart, rStart);
  const e = Math.min(bEnd, rEnd);
  return e > s ? e - s : 0;
}

export interface ClippedBlock {
  block: TimeBlock;
  clippedMs: number;
}

/** Returns blocks that overlap [start,end] with their clipped duration. */
export function clipBlocks(blocks: TimeBlock[], start: number, end: number): ClippedBlock[] {
  const out: ClippedBlock[] = [];
  for (const b of blocks) {
    const ms = overlapMs(b.start, b.end, start, end);
    if (ms > 0) out.push({ block: b, clippedMs: ms });
  }
  return out;
}

export interface TypeTotals {
  focus: number;
  distraction: number;
  neutral: number;
  break: number;
}

/** Sums clipped ms per category type; break blocks go into their own bucket. */
export function sumByType(items: ClippedBlock[]): TypeTotals {
  const out: TypeTotals = { focus: 0, distraction: 0, neutral: 0, break: 0 };
  for (const { block, clippedMs } of items) {
    if (block.isBreak) out.break += clippedMs;
    else out[block.type] += clippedMs;
  }
  return out;
}

/** Session count and average clipped duration, excluding break blocks. */
export function sessionStats(items: ClippedBlock[]): { count: number; avgMs: number } {
  const sessions = items.filter((i) => !i.block.isBreak);
  const totalMs = sessions.reduce((s, i) => s + i.clippedMs, 0);
  return {
    count: sessions.length,
    avgMs: sessions.length ? Math.round(totalMs / sessions.length) : 0,
  };
}

/**
 * Iterates calendar days (local time, DST-safe) covering [startMs, endMs].
 * `dayEnd` is the exclusive next-midnight boundary — pair it with overlapMs,
 * which treats range ends as exclusive.
 */
export function eachLocalDay(
  startMs: number,
  endMs: number,
): { dayStart: number; dayEnd: number; date: Date }[] {
  const out: { dayStart: number; dayEnd: number; date: Date }[] = [];
  if (endMs < startMs) return out;
  const s = new Date(startMs);
  s.setHours(0, 0, 0, 0);
  const y = s.getFullYear();
  const m = s.getMonth();
  const d = s.getDate();
  for (let i = 0; ; i++) {
    const date = new Date(y, m, d + i);
    const dayStart = date.getTime();
    if (dayStart > endMs) break;
    const dayEnd = new Date(y, m, d + i + 1).getTime();
    out.push({ dayStart, dayEnd, date });
  }
  return out;
}

export function topByCategory(items: ClippedBlock[]): { name: string; ms: number }[] {
  const map = new Map<string, number>();
  for (const { block, clippedMs } of items) {
    map.set(block.categoryName, (map.get(block.categoryName) ?? 0) + clippedMs);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, ms]) => ({ name, ms }));
}
