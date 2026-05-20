import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, BellRing, Download, LogIn, LogOut, Moon, Pencil, Sun, Timer as TimerIcon, Trash2, Upload, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ChromeImportSheet } from "@/components/focuslog/ChromeImportSheet";
import { useFocusLog } from "@/lib/focuslog/context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CategoryDialog } from "@/components/focuslog/CategoryDialog";
import { exportBlocksToXlsx } from "@/lib/focuslog/export";
import { startOfDay, endOfDay } from "@/lib/focuslog/format";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/focuslog/types";
import {
  loadPomodoro, savePomodoro, loadPauseAlerts, savePauseAlerts, type PomodoroConfig,
} from "@/lib/focuslog/alerts";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "FocusLog — Settings" }] }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const { categories, deleteCategory, reorderCategories, theme, setTheme, blocks, clearAllData } = useFocusLog();
  const { user, guest, exitGuest, signOut } = useAuth();
  const [editing, setEditing] = useState<Category | null>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pomo, setPomo] = useState<PomodoroConfig>(() => loadPomodoro());
  const [pauseAlerts, setPauseAlerts] = useState<boolean>(() => loadPauseAlerts());
  useEffect(() => { savePomodoro(pomo); }, [pomo]);
  useEffect(() => { savePauseAlerts(pauseAlerts); }, [pauseAlerts]);

  const move = (idx: number, dir: -1 | 1) => {
    const ids = categories.map((c) => c.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorderCategories(ids);
  };

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Settings</div>
        <h1 className="mt-1 text-2xl font-semibold">Preferences</h1>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <Label htmlFor="theme">Dark mode</Label>
          </div>
          <Switch
            id="theme"
            checked={theme === "dark"}
            onCheckedChange={(c) => setTheme(c ? "dark" : "light")}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold">Categories</h2>
          <Button size="sm" variant="ghost" onClick={() => setNewCatOpen(true)}>+ Add</Button>
        </div>
        <ul className="divide-y divide-border">
          {categories.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 px-4 py-3">
              <span className={
                c.type === "focus" ? "h-2 w-2 rounded-full bg-focus"
                : c.type === "distraction" ? "h-2 w-2 rounded-full bg-distraction"
                : "h-2 w-2 rounded-full bg-neutral"
              } />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="text-[11px] capitalize text-muted-foreground">{c.type}</div>
              </div>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md p-1.5 text-muted-foreground disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === categories.length - 1} className="rounded-md p-1.5 text-muted-foreground disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button onClick={() => setEditing(c)} className="rounded-md p-1.5 text-muted-foreground" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => deleteCategory(c.id)} className="rounded-md p-1.5 text-distraction" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Data</h2>
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="justify-start" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Import Chrome History
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" /> Export to Excel
          </Button>
          <Button variant="outline" className="justify-start text-distraction hover:text-distraction" onClick={() => setConfirmClear(true)}>
            <Trash2 className="h-4 w-4" /> Delete all data
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {guest ? `${blocks.length} entries stored on this device.` : `${blocks.length} entries synced to your account.`}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TimerIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Pomodoro</h2>
          </div>
          <Switch checked={pomo.enabled} onCheckedChange={(c) => setPomo((p) => ({ ...p, enabled: c }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Work (min)</span>
            <Input type="number" min={1} max={120} value={pomo.workMin}
              onChange={(e) => setPomo((p) => ({ ...p, workMin: Math.min(120, Math.max(1, Number(e.target.value) || 1)) }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Break (min)</span>
            <Input type="number" min={1} max={120} value={pomo.breakMin}
              onChange={(e) => setPomo((p) => ({ ...p, breakMin: Math.min(120, Math.max(1, Number(e.target.value) || 1)) }))} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label>Pause alerts</Label>
              <p className="text-[11px] text-muted-foreground">Beep at 5, 10, 15, 30, 60, 90 min while paused.</p>
            </div>
          </div>
          <Switch checked={pauseAlerts} onCheckedChange={setPauseAlerts} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Account</h2>
        {guest ? (
          <>
            <p className="mb-3 text-[11px] text-muted-foreground">Guest — data stays on this device.</p>
            <Button variant="outline" className="w-full justify-start" onClick={exitGuest}>
              <LogIn className="h-4 w-4" /> Sign in to sync
            </Button>
          </>
        ) : (
          <>
            <p className="mb-3 text-[11px] text-muted-foreground truncate">{user?.email ?? "Signed in"}</p>
            <Button variant="outline" className="w-full justify-start" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <Link to="/changelog" className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Changelog</span>
          <span className="text-xs text-muted-foreground">What's new →</span>
        </Link>
      </section>


      <CategoryDialog open={newCatOpen} onOpenChange={setNewCatOpen} />
      <CategoryDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ? { id: editing.id, name: editing.name, type: editing.type } : undefined}
      />
      <ExportSheet open={exportOpen} onOpenChange={setExportOpen} />
      <ChromeImportSheet open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="max-w-[92vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes every logged activity and resets categories to defaults. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearAllData} className="bg-distraction text-distraction-foreground hover:bg-distraction/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Range = "today" | "7d" | "30d" | "all" | "custom";

function ExportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { blocks } = useFocusLog();
  const [range, setRange] = useState<Range>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const presets: { value: Range; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "all", label: "All time" },
    { value: "custom", label: "Custom" },
  ];

  const doExport = () => {
    const now = Date.now();
    let start = 0, end = endOfDay(now);
    if (range === "today") start = startOfDay(now);
    else if (range === "7d") start = startOfDay(now - 6 * 86400000);
    else if (range === "30d") start = startOfDay(now - 29 * 86400000);
    else if (range === "all") start = 0;
    else if (range === "custom") {
      if (!from || !to) return;
      start = new Date(from + "T00:00:00").getTime();
      end = new Date(to + "T23:59:59").getTime();
    }
    const filtered = blocks.filter((b) => b.start >= start && b.start <= end);
    const stamp = new Date().toISOString().slice(0, 10);
    exportBlocksToXlsx(filtered, `focuslog-${range}-${stamp}.xlsx`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border">
        <SheetHeader className="text-left">
          <SheetTitle>Export to Excel</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-3 pb-6">
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setRange(p.value)}
                data-on={range === p.value}
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-muted-foreground data-[on=true]:border-accent data-[on=true]:bg-accent data-[on=true]:text-accent-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}
          <Button className="w-full" onClick={doExport}>
            <Download className="h-4 w-4" /> Download .xlsx
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
