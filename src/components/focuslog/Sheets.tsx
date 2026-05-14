import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFocusLog } from "@/lib/focuslog/context";
import { fmtClock, fmtDuration } from "@/lib/focuslog/format";
import type { TimeBlock } from "@/lib/focuslog/types";

function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(s: string) { return new Date(s).getTime(); }

interface SaveSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  draft: { categoryId: string; categoryName: string; start: number; end: number; activeMs: number } | null;
  initialNote?: string;
  onSave: (note: string) => void;
  onDiscard: () => void;
}

export function SaveActivitySheet({ open, onOpenChange, draft, initialNote, onSave, onDiscard }: SaveSheetProps) {
  const [note, setNote] = useState("");
  useEffect(() => { if (open) setNote(initialNote ?? ""); }, [open, initialNote]);
  if (!draft) return null;
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setNote(""); onOpenChange(o); }}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border">
        <SheetHeader className="text-left">
          <SheetTitle>Save activity</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-2 pb-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Category</div>
            <div className="mt-1 text-lg font-semibold">{draft.categoryName}</div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Start</div>
                <div className="font-medium">{fmtClock(draft.start)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">End</div>
                <div className="font-medium">{fmtClock(draft.end)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Active</div>
                <div className="font-medium">{fmtDuration(draft.activeMs)}</div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you focus on?"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onDiscard}>Discard</Button>
            <Button className="flex-1" onClick={() => { onSave(note); setNote(""); }}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface AddPastProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate?: number;
}

export function AddPastActivitySheet({ open, onOpenChange, defaultDate }: AddPastProps) {
  const { categories, addPastBlock } = useFocusLog();
  const base = defaultDate ?? Date.now();
  const [start, setStart] = useState(toLocalInput(base - 60 * 60 * 1000));
  const [end, setEnd] = useState(toLocalInput(base));
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [note, setNote] = useState("");

  const valid = useMemo(() => {
    const s = fromLocalInput(start), e = fromLocalInput(end);
    return categoryId && !isNaN(s) && !isNaN(e) && e > s;
  }, [start, end, categoryId]);

  const submit = () => {
    if (!valid) return;
    addPastBlock({
      categoryId,
      start: fromLocalInput(start),
      end: fromLocalInput(end),
      note,
    });
    onOpenChange(false);
    setNote("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border">
        <SheetHeader className="text-left">
          <SheetTitle>Add past activity</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-2 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ps">Start</Label>
              <Input id="ps" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pe">End</Label>
              <Input id="pe" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  data-on={categoryId === c.id}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground data-[on=true]:border-accent data-[on=true]:bg-accent data-[on=true]:text-accent-foreground"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pn">Note (optional)</Label>
            <Input id="pn" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={!valid}>Add</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface EditBlockProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  block: TimeBlock | null;
}

export function EditBlockSheet({ open, onOpenChange, block }: EditBlockProps) {
  const { categories, updateBlock, deleteBlock } = useFocusLog();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");

  // initialize when block changes
  useMemo(() => {
    if (block) {
      setStart(toLocalInput(block.start));
      setEnd(toLocalInput(block.end));
      setCategoryId(block.categoryId);
      setNote(block.note ?? "");
    }
  }, [block]);

  if (!block) return null;
  const isBreak = block.isBreak;

  const save = () => {
    const s = fromLocalInput(start), e = fromLocalInput(end);
    if (isNaN(s) || isNaN(e) || e <= s) return;
    updateBlock(block.id, {
      start: s, end: e,
      categoryId: isBreak ? undefined : categoryId,
      note,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border">
        <SheetHeader className="text-left">
          <SheetTitle>{isBreak ? "Edit break" : "Edit activity"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-2 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {!isBreak && (
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    data-on={categoryId === c.id}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground data-[on=true]:border-accent data-[on=true]:bg-accent data-[on=true]:text-accent-foreground"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-distraction" onClick={() => { deleteBlock(block.id); onOpenChange(false); }}>Delete</Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
