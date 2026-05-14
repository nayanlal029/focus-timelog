import { useRef, useState } from "react";
import { Upload, FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { useFocusLog } from "@/lib/focuslog/context";
import { buildImportPlan, type ImportPlan } from "@/lib/focuslog/chromeImport";
import { fmtDuration } from "@/lib/focuslog/format";
import { toast } from "sonner";

export function ChromeImportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { categories, addCategory, addManyPastBlocks } = useFocusLog();
  const [parsing, setParsing] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [gap, setGap] = useState(5);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const rawRef = useRef<unknown>(null);

  const reset = () => { setPlan(null); setFilename(""); rawRef.current = null; if (fileRef.current) fileRef.current.value = ""; };

  const onFile = async (file: File) => {
    setParsing(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      rawRef.current = json;
      setFilename(file.name);
      const p = buildImportPlan(json, categories, {
        gapMinutes: gap,
        fromMs: from ? new Date(from + "T00:00:00").getTime() : undefined,
        toMs: to ? new Date(to + "T23:59:59").getTime() : undefined,
      });
      setPlan(p);
      if (p.totalVisits === 0) toast.warning("No visits found in this file.");
    } catch (e) {
      console.error(e);
      toast.error("Could not read this file. Expected Chrome History.json from Google Takeout.");
    } finally {
      setParsing(false);
    }
  };

  const recompute = () => {
    if (!rawRef.current) return;
    const p = buildImportPlan(rawRef.current, categories, {
      gapMinutes: gap,
      fromMs: from ? new Date(from + "T00:00:00").getTime() : undefined,
      toMs: to ? new Date(to + "T23:59:59").getTime() : undefined,
    });
    setPlan(p);
  };

  const doImport = () => {
    if (!plan) return;
    // Create any missing categories using the inferred type from segments
    const created = new Map<string, string>(); // name -> new id
    if (plan.unmatchedNames.length) {
      for (const name of plan.unmatchedNames) {
        const seg = plan.segments.find((s) => s.categoryName === name);
        const cat = addCategory(name, seg?.type ?? "neutral");
        created.set(name, cat.id);
      }
    }
    const inputs = plan.segments.map((s) => ({
      categoryId: s.categoryId.startsWith("__pending__") ? (created.get(s.categoryName) ?? s.categoryId) : s.categoryId,
      start: s.start,
      end: s.end,
      note: s.note,
      link: s.link,
    })).filter((i) => !i.categoryId.startsWith("__pending__"));

    const n = addManyPastBlocks(inputs);
    toast.success(`Imported ${n} segments from browser history.`);
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Import Chrome History</SheetTitle>
          <SheetDescription>
            Upload a Chrome history JSON — Google Takeout <code className="text-xs">History.json</code> or a flat array export (e.g. Quick Chrome History Export). Visits are grouped into segments and matched to your categories.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-3 pb-6">
          <div>
            <Label htmlFor="hist-file" className="text-xs uppercase tracking-wider text-muted-foreground">File</Label>
            <Input
              id="hist-file"
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              className="mt-1"
            />
            {filename && <p className="mt-1 text-[11px] text-muted-foreground"><FileJson className="mr-1 inline h-3 w-3" />{filename}</p>}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="gap" className="text-[11px] uppercase tracking-wider text-muted-foreground">Gap (min)</Label>
              <Input id="gap" type="number" min={1} max={60} value={gap} onChange={(e) => setGap(Math.max(1, Number(e.target.value) || 5))} onBlur={recompute} />
            </div>
            <div>
              <Label htmlFor="hist-from" className="text-[11px] uppercase tracking-wider text-muted-foreground">From</Label>
              <Input id="hist-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} onBlur={recompute} />
            </div>
            <div>
              <Label htmlFor="hist-to" className="text-[11px] uppercase tracking-wider text-muted-foreground">To</Label>
              <Input id="hist-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} onBlur={recompute} />
            </div>
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
            </div>
          )}

          {plan && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground tabular-nums">
                {plan.totalVisits.toLocaleString()} visits → {plan.segments.length} segments
              </div>
              <ul className="divide-y divide-border max-h-64 overflow-y-auto">
                {Object.entries(plan.byCategory).sort((a, b) => b[1].ms - a[1].ms).map(([name, info]) => {
                  const isNew = plan.unmatchedNames.includes(name);
                  return (
                    <li key={name} className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={
                          info.type === "focus" ? "h-2 w-2 rounded-full bg-focus"
                          : info.type === "distraction" ? "h-2 w-2 rounded-full bg-distraction"
                          : "h-2 w-2 rounded-full bg-neutral"
                        } />
                        <span className="font-medium">{name}</span>
                        {isNew && <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">new</span>}
                      </div>
                      <div className="tabular-nums text-xs text-muted-foreground">
                        {info.count} · {fmtDuration(info.ms)}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {plan.unmatchedNames.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {plan.unmatchedNames.length} new categor{plan.unmatchedNames.length === 1 ? "y" : "ies"} will be created.
                </p>
              )}
            </div>
          )}

          <Button className="w-full" onClick={doImport} disabled={!plan || plan.segments.length === 0}>
            <Upload className="h-4 w-4" /> Import {plan ? `${plan.segments.length} segments` : ""}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
