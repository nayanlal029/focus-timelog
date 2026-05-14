import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";
import { useFocusLog } from "@/lib/focuslog/context";
import { fmtHMS, haptic } from "@/lib/focuslog/format";

interface Props {
  open: boolean;
  onResume: () => void;
  onStop: () => void;
}

export function BreakPopup({ open, onResume, onStop }: Props) {
  const { active, computeBreakMs, getCategory } = useFocusLog();
  if (!active) return null;
  const cat = getCategory(active.categoryId);
  const breakMs = computeBreakMs();

  return (
    <Dialog open={open}>
      <DialogContent
        className="flex h-dvh max-h-dvh w-full max-w-md flex-col items-center justify-between gap-0 rounded-none border-0 bg-background p-0 sm:rounded-none [&>button.absolute]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Break — {cat?.name ?? "Activity"} paused</DialogTitle>
        <div className="w-full px-6 pt-12 text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Paused</div>
          <div className="mt-1 text-2xl font-semibold">{cat?.name ?? "Activity"}</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Break</div>
          <div className="mt-2 text-7xl font-bold tabular-nums leading-none">{fmtHMS(breakMs)}</div>
        </div>
        <div className="flex w-full flex-col gap-3 px-6 pb-12">
          <Button
            size="lg"
            className="h-14 rounded-2xl text-base"
            onClick={() => { haptic(12); onResume(); }}
          >
            <Play className="h-5 w-5" /> Resume
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-14 rounded-2xl border-distraction/50 bg-transparent text-base text-distraction hover:bg-distraction/10 hover:text-distraction"
            onClick={() => { haptic(20); onStop(); }}
          >
            <Square className="h-5 w-5" /> Stop
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
