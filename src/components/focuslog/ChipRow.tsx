import { Plus } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/focuslog/format";

interface Props {
  activeId: string | null;
  disabledStart: boolean;
  onPick: (id: string) => void;
  onAddNew: () => void;
}

export function ChipRow({ activeId, disabledStart, onPick, onAddNew }: Props) {
  const { categories } = useFocusLog();
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2 pb-1">
        {categories.map((c) => {
          const isActive = c.id === activeId;
          const dimmed = disabledStart && !isActive;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabledStart}
              onClick={() => { haptic(8); onPick(c.id); }}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-accent bg-accent text-accent-foreground shadow-[0_0_0_3px_oklch(0.36_0.07_252_/_0.25)]"
                  : "border-border bg-card text-foreground/85",
                dimmed && "opacity-40",
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
          className="shrink-0 rounded-full border border-dashed border-border bg-transparent px-3.5 py-2 text-sm font-medium text-muted-foreground"
        >
          <span className="flex items-center gap-1"><Plus className="h-4 w-4" /> Add</span>
        </button>
      </div>
    </div>
  );
}
