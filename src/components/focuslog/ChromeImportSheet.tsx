import { useEffect, useRef, useState } from "react";
import { Upload, FileJson, Loader2, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { useFocusLog } from "@/lib/focuslog/context";
import { buildImportPlan, type ImportPlan } from "@/lib/focuslog/chromeImport";
import { buildCsvPlan, type CsvPlan } from "@/lib/focuslog/csvImport";
import { fmtDuration } from "@/lib/focuslog/format";
import { toast } from "sonner";

const LAST_IMPORT_KEY = "focuslog:lastImportIds";

function loadLastImport(): { ids: string[]; at: number; source: string } | null {
  try {
    const raw = localStorage.getItem(LAST_IMPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.ids)) return null;
    return parsed;
  } catch { return null; }
}
function saveLastImport(ids: string[], source: string) {
  try { localStorage.setItem(LAST_IMPORT_KEY, JSON.stringify({ ids, at: Date.now(), source })); } catch { /* noop */ }
}
function clearLastImport() {
  try { localStorage.removeItem(LAST_IMPORT_KEY); } catch { /* noop */ }
}

type Mode = "chrome" | "csv";

export function ChromeImportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { categories, addCategory, addManyPastBlocks, deleteBlocks, blocks } = useFocusLog();
  const [mode, setMode] = useState<Mode>("chrome");
  const [parsing, setParsing] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [csvPlan, setCsvPlan] = useState<CsvPlan | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [lastImport, setLastImport] = useState<ReturnType<typeof loadLastImport>>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rawRef = useRef<unknown>(null);

  useEffect(() => { if (open) setLastImport(loadLastImport()); }, [open]);

  const reset = () => {
    setPlan(null); setCsvPlan(null); setFilename(""); rawRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File) => {
    setParsing(true);
    try {
      const text = await file.text();
      setFilename(file.name);
      if (mode === "chrome") {
        const json = JSON.parse(text);
        rawRef.current = json;
        const p = buildImportPlan(json, categories);
        setPlan(p);
        setCsvPlan(null);
        if (p.totalVisits === 0) toast.warning("No visits found in this file.");
      } else {
        const p = buildCsvPlan(text, categories);
        setCsvPlan(p);
        setPlan(null);
        if (p.rows.length === 0) toast.warning("No valid rows found in this CSV.");
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setParsing(false);
    }
  };

  const doImport = () => {
    if (mode === "chrome" && plan) {
      const created = new Map<string, string>();
      for (const name of plan.unmatchedNames) {
        const seg = plan.segments.find((s) => s.categoryName === name);
        const cat = addCategory(name, seg?.type ?? "neutral");
        created.set(name, cat.id);
      }
      const inputs = plan.segments.map((s) => ({
        categoryId: s.categoryId.startsWith("__pending__") ? (created.get(s.categoryName) ?? s.categoryId) : s.categoryId,
        start: s.start, end: s.end, note: s.note, link: s.link,
      })).filter((i) => !i.categoryId.startsWith("__pending__"));
      const ids = addManyPastBlocks(inputs);
      saveLastImport(ids, "Chrome history");
      setLastImport({ ids, at: Date.now(), source: "Chrome history" });
      toast.success(`Imported ${ids.length} segments. Undo available.`);
      reset();
      onOpenChange(false);
    } else if (mode === "csv" && csvPlan) {
      const created = new Map<string, string>();
      for (const u of csvPlan.unmatchedNames) {
        const cat = addCategory(u.name, u.type);
        created.set(u.name, cat.id);
      }
      const inputs = csvPlan.rows.map((r) => ({
        categoryId: r.categoryId.startsWith("__pending__") ? (created.get(r.categoryName) ?? r.categoryId) : r.categoryId,
        start: r.start, end: r.end, note: r.note, link: r.link,
      })).filter((i) => !i.categoryId.startsWith("__pending__"));
      const ids = addManyPastBlocks(inputs);
      saveLastImport(ids, `CSV (${filename})`);
      setLastImport({ ids, at: Date.now(), source: `CSV (${filename})` });
      toast.success(`Imported ${ids.length} rows from CSV. Undo available.`);
      reset();
      onOpenChange(false);
    }
  };

  const undoLast = () => {
    if (!lastImport) return;
    const existing = new Set(blocks.map((b) => b.id));
    const toDel = lastImport.ids.filter((id) => existing.has(id));
    deleteBlocks(toDel);
    clearLastImport();
    setLastImport(null);
    toast.success(`Removed ${toDel.length} imported entries.`);
  };

  const deleteAllImported = () => {
    // Browser/CSV imports are the only blocks with a `link` field set.
    const ids = blocks.filter((b) => b.link).map((b) => b.id);
    if (!ids.length) { toast.info("No imported entries found."); return; }
    deleteBlocks(ids);
    clearLastImport();
    setLastImport(null);
    toast.success(`Removed ${ids.length} imported entries.`);
  };

  const summary = mode === "chrome" ? plan : csvPlan;

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Import data</SheetTitle>
          <SheetDescription>
            Import browser history JSON or a CSV file. You can undo the most recent import or wipe all imported entries.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-3 pb-6">
          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-2">
            {(["chrome", "csv"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); reset(); }}
                data-on={mode === m}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground data-[on=true]:border-accent data-[on=true]:bg-accent data-[on=true]:text-accent-foreground"
              >
                {m === "chrome" ? "Chrome history (JSON)" : "CSV file"}
              </button>
            ))}
          </div>

          {/* Undo / cleanup */}
          {lastImport && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3">
              <div className="text-[11px] text-muted-foreground">
                Last import: {lastImport.ids.length} entries · {lastImport.source}
              </div>
              <Button size="sm" variant="outline" onClick={undoLast}>
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
            </div>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start text-distraction hover:text-distraction" onClick={deleteAllImported}>
            <Trash2 className="h-4 w-4" /> Delete all browser-imported entries
          </Button>

          <div>
            <Label htmlFor="hist-file" className="text-xs uppercase tracking-wider text-muted-foreground">
              {mode === "chrome" ? "Chrome history JSON" : "CSV file"}
            </Label>
            <Input
              id="hist-file"
              ref={fileRef}
              type="file"
              accept={mode === "chrome" ? "application/json,.json" : "text/csv,.csv"}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              className="mt-1"
            />
            {filename && <p className="mt-1 text-[11px] text-muted-foreground"><FileJson className="mr-1 inline h-3 w-3" />{filename}</p>}
            {mode === "csv" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Columns: Date, Start Time, End Time, Category, Type, Note, Link (matches the Excel export).
              </p>
            )}
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
            </div>
          )}

          {mode === "chrome" && plan && (
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
                        <span className={info.type === "focus" ? "h-2 w-2 rounded-full bg-focus" : info.type === "distraction" ? "h-2 w-2 rounded-full bg-distraction" : "h-2 w-2 rounded-full bg-neutral"} />
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

          {mode === "csv" && csvPlan && (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground tabular-nums">
                {csvPlan.rows.length} rows ready{csvPlan.skipped ? ` · ${csvPlan.skipped} skipped` : ""}
              </div>
              {csvPlan.unmatchedNames.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {csvPlan.unmatchedNames.length} new categor{csvPlan.unmatchedNames.length === 1 ? "y" : "ies"} will be created.
                </p>
              )}
            </div>
          )}

          <Button className="w-full" onClick={doImport} disabled={!summary || (mode === "chrome" ? !plan?.segments.length : !csvPlan?.rows.length)}>
            <Upload className="h-4 w-4" /> Import {mode === "chrome" ? (plan ? `${plan.segments.length} segments` : "") : (csvPlan ? `${csvPlan.rows.length} rows` : "")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
