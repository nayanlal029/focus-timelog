import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/focuslog/format";

interface Props {
  selectedId: string | null;
  activeId: string | null;
  disabled?: boolean;
  onPick: (id: string) => void;
  onAddNew: () => void;
}

export function ChipRow({ selectedId, activeId, disabled, onPick, onAddNew }: Props) {
  const { categories, blocks } = useFocusLog();

  const sorted = useMemo(() => {
    const lastUsed = new Map<string, number>();
    for (const b of blocks) {
      if (b.isBreak) continue;
      const prev = lastUsed.get(b.categoryId) ?? 0;
      if (b.start > prev) lastUsed.set(b.categoryId, b.start);
    }
    return [...categories].sort((a, b) => {
      const la = lastUsed.get(a.id) ?? 0;
      const lb = lastUsed.get(b.id) ?? 0;
      if (lb !== la) return lb - la;
      return a.order - b.order;
    });
  }, [categories, blocks]);

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((c) => {
        const isSelected = c.id === selectedId;
        const isActive = c.id === activeId;
        return (
          <button
            key={c.id}
            type="button"
            disabled={disabled && !isActive}
            onClick={() => { haptic(8); onPick(c.id); }}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-accent bg-accent text-accent-foreground shadow-[0_0_0_3px_oklch(0.36_0.07_252_/_0.25)]"
                : isSelected
                  ? "border-foreground/60 bg-card text-foreground"
                  : "border-border bg-card text-foreground/85",
              disabled && !isActive && "opacity-40",
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                c.type === "focus" && "bg-focus",
                c.type === "distraction" && "bg-distraction",
                c.type === "neutral" && "bg-neutral",
              )} />
              {c.name}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAddNew}
        className="shrink-0 rounded-full border border-dashed border-border bg-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground"
      >
        <span className="flex items-center gap-1"><Plus className="h-4 w-4" /> Add</span>
      </button>
    </div>
  );
}
