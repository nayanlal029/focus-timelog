import type { TimeBlock, CategoryType } from "./types";

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

export function sumByType(items: ClippedBlock[]): Record<CategoryType, number> {
  const out: Record<CategoryType, number> = { focus: 0, distraction: 0, neutral: 0 };
  for (const { block, clippedMs } of items) out[block.type] += clippedMs;
  return out;
}

export function topByCategory(items: ClippedBlock[]): { name: string; ms: number }[] {
  const map = new Map<string, number>();
  for (const { block, clippedMs } of items) {
    map.set(block.categoryName, (map.get(block.categoryName) ?? 0) + clippedMs);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, ms]) => ({ name, ms }));
}
