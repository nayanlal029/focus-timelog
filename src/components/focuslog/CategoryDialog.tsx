import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFocusLog } from "@/lib/focuslog/context";
import type { CategoryType } from "@/lib/focuslog/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: { id: string; name: string; type: CategoryType };
}

const types: { value: CategoryType; label: string; cls: string }[] = [
  { value: "focus", label: "Focus", cls: "border-focus/40 data-[on=true]:bg-focus/15 data-[on=true]:text-focus data-[on=true]:border-focus" },
  { value: "distraction", label: "Distraction", cls: "border-distraction/40 data-[on=true]:bg-distraction/15 data-[on=true]:text-distraction data-[on=true]:border-distraction" },
  { value: "neutral", label: "Neutral", cls: "border-neutral/40 data-[on=true]:bg-neutral/25 data-[on=true]:text-foreground data-[on=true]:border-neutral" },
];

export function CategoryDialog({ open, onOpenChange, initial }: Props) {
  const { addCategory, updateCategory } = useFocusLog();
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("focus");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setType(initial?.type ?? "focus");
    }
  }, [open, initial]);

  const submit = () => {
    if (!name.trim()) return;
    if (initial) updateCategory(initial.id, { name: name.trim(), type });
    else addCategory(name.trim(), type);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reading"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {types.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  data-on={type === t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    "rounded-xl border bg-card px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors",
                    t.cls,
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!name.trim()}>{initial ? "Save" : "Add"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
