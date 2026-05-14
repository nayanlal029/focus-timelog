import { cn } from "@/lib/utils";
import type { CategoryType } from "@/lib/focuslog/types";

const styles: Record<CategoryType, string> = {
  focus: "bg-focus/15 text-focus border-focus/30",
  distraction: "bg-distraction/15 text-distraction border-distraction/30",
  neutral: "bg-neutral/15 text-foreground border-neutral/30",
};

const dotStyles: Record<CategoryType, string> = {
  focus: "bg-focus",
  distraction: "bg-distraction",
  neutral: "bg-neutral",
};

export function TypeDot({ type, className }: { type: CategoryType; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", dotStyles[type], className)} />;
}

export function typePillClasses(type: CategoryType) {
  return styles[type];
}
