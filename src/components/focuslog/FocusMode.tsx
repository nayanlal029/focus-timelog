import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Pencil, Maximize2, Minimize2, X, Plus } from "lucide-react";
import { fmtHMS, haptic } from "@/lib/focuslog/format";
import { Textarea } from "@/components/ui/textarea";
import { LapTimer } from "@/components/focuslog/LapTimer";
import { cn } from "@/lib/utils";

interface Props {
  activeMs: number;
  breakMs?: number;
  categoryName: string;
  isPaused: boolean;
  note: string;
  onNoteChange: (s: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function FocusMode({
  activeMs, breakMs = 0, categoryName, isPaused, note, onNoteChange,
  onPause, onResume, onStop,
}: Props) {
  const [revealed, setRevealed] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [lapOpen, setLapOpen] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // auto-hide chrome after a few seconds
  const scheduleHide = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!noteOpen) setRevealed(false);
    }, 3500);
  };
  useEffect(() => {
    scheduleHide();
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteOpen]);

  // fullscreen state sync
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const reveal = () => {
    setRevealed(true);
    scheduleHide();
  };

  const toggleFs = async () => {
    haptic(10);
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {/* ignore */}
  };

  return (
    <div
      ref={rootRef}
      onClick={reveal}
      onTouchStart={reveal}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background text-foreground select-none"
    >
      {/* Top-right small chrome */}
      <div
        className={cn(
          "absolute right-3 top-3 flex items-center gap-1.5 transition-opacity duration-300",
          revealed ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); haptic(8); setNoteOpen(true); reveal(); }}
          aria-label="Add note"
          className="rounded-full border border-border bg-card/80 p-1.5 backdrop-blur"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFs(); }}
          aria-label="Toggle fullscreen"
          className="rounded-full border border-border bg-card/80 p-1.5 backdrop-blur"
        >
          {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Category label */}
      <div
        className={cn(
          "absolute left-1/2 top-10 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-muted-foreground transition-opacity duration-500",
          revealed ? "opacity-100" : "opacity-30",
        )}
      >
        {categoryName}{isPaused ? " · paused" : ""}
      </div>

      {/* Big timer — always visible. When paused, show red break/distraction timer.
          When the lap timer is open, the main timer recedes to a compact readout. */}
      <div className="flex w-full flex-col items-center px-4">
        <div
          className={cn(
            "font-bold tabular-nums tracking-tight leading-none transition-all duration-300",
            lapOpen ? "text-[clamp(28px,6vw,40px)] opacity-50" : "text-[clamp(72px,22vw,180px)]",
            isPaused ? "text-distraction" : "text-foreground",
          )}
        >
          {fmtHMS(isPaused ? breakMs : activeMs)}
        </div>
        {isPaused && !lapOpen && (
          <div className="mt-3 text-xs uppercase tracking-[0.3em] text-distraction/80">
            Distracted · focus {fmtHMS(activeMs)}
          </div>
        )}

        {lapOpen ? (
          <div className="mt-5 w-full flex justify-center">
            <LapTimer onClose={() => setLapOpen(false)} />
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); haptic(10); setLapOpen(true); reveal(); }}
            aria-label="Start lap timer"
            className={cn(
              "mt-8 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/70 text-muted-foreground backdrop-blur transition-opacity duration-300 hover:text-foreground active:scale-95",
              revealed ? "opacity-100" : "opacity-30",
            )}
          >
            <Plus className="h-5 w-5" />
          </button>
        )}

        {note && !lapOpen && (
          <div
            className={cn(
              "mt-6 max-w-xs px-4 text-center text-sm text-muted-foreground transition-opacity",
              revealed ? "opacity-100" : "opacity-40",
            )}
          >
            {note}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-10 flex justify-center gap-3 px-6 transition-opacity duration-300",
          revealed ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {isPaused ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); haptic(10); onResume(); reveal(); }}
            className="flex h-14 items-center gap-2 rounded-full bg-accent px-7 text-base font-semibold text-accent-foreground shadow-md active:scale-95"
          >
            <Play className="h-5 w-5 fill-current" /> Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); haptic(15); onPause(); reveal(); }}
            className="flex h-14 items-center gap-2 rounded-full border border-border bg-card px-7 text-base font-semibold text-foreground active:scale-95"
          >
            <Pause className="h-5 w-5" /> Pause
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); haptic(20); onStop(); }}
          className="flex h-14 items-center gap-2 rounded-full border border-distraction/40 bg-distraction/15 px-7 text-base font-semibold text-distraction active:scale-95"
        >
          <Square className="h-5 w-5 fill-current" /> Stop
        </button>
      </div>

      {/* Note overlay */}
      {noteOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-10 flex items-end bg-background/80 backdrop-blur-sm"
        >
          <div className="w-full rounded-t-3xl border-t border-border bg-card p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Quick note</div>
              <button
                type="button"
                onClick={() => { setNoteOpen(false); reveal(); }}
                className="rounded-full border border-border p-1"
                aria-label="Close note"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              autoFocus
              rows={3}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Jot a thought…"
              className="resize-none"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => { setNoteOpen(false); reveal(); }}
                className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
