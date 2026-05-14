import { useMemo } from "react";
import { Download, Eye } from "lucide-react";
import { useFilter } from "@/lib/focuslog/filter-context";
import { useFocusLog } from "@/lib/focuslog/context";
import { fmtDuration } from "@/lib/focuslog/format";
import { exportBlocksToXlsx } from "@/lib/focuslog/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FilterPanel({ onView }: { onView?: () => void }) {
  const { blocks } = useFocusLog();
  const { from, to, fromTime, toTime, setFrom, setTo, setFromTime, setToTime, range, applyPreset } = useFilter();

  const filtered = useMemo(() => {
    if (!range) return [];
    return blocks.filter((b) => b.start >= range.start && b.start <= range.end);
  }, [blocks, range]);

  const totals = useMemo(() => {
    const t = { focus: 0, distraction: 0, neutral: 0 };
    filtered.forEach((b) => {
      const d = b.end - b.start;
      if (b.type === "focus") t.focus += d;
      else if (b.type === "distraction") t.distraction += d;
      else t.neutral += d;
    });
    return t;
  }, [filtered]);

  const downloadFiltered = () => {
    if (!range || filtered.length === 0) return;
    exportBlocksToXlsx(filtered, `focuslog-${from}_to_${to}.xlsx`);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="from-date" className="text-[11px] uppercase tracking-wider text-muted-foreground">From</Label>
          <Input id="from-date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input aria-label="From time" type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to-date" className="text-[11px] uppercase tracking-wider text-muted-foreground">To</Label>
          <Input id="to-date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input aria-label="To time" type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Today", days: 0 },
          { label: "7d", days: 6 },
          { label: "30d", days: 29 },
          { label: "90d", days: 89 },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.days)}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs">
        <div className="tabular-nums">
          <span className="text-muted-foreground">{filtered.length} entries · </span>
          <span className="text-focus">{fmtDuration(totals.focus)}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-distraction">{fmtDuration(totals.distraction)}</span>
        </div>
        <div className="flex items-center gap-2">
          {onView && (
            <Button size="sm" variant="outline" onClick={onView} disabled={!range || filtered.length === 0}>
              <Eye className="h-4 w-4" /> View
            </Button>
          )}
          <Button size="sm" onClick={downloadFiltered} disabled={!range || filtered.length === 0}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>
    </section>
  );
}
