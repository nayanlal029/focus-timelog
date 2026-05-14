export type CategoryType = "focus" | "distraction" | "neutral";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  order: number;
  builtin?: boolean;
}

export interface TimeBlock {
  id: string;
  categoryId: string; // for breaks: "__break__"
  categoryName: string; // snapshot for safety
  type: CategoryType;
  start: number; // epoch ms
  end: number; // epoch ms
  note?: string;
  isBreak?: boolean;
}

export const BREAK_CATEGORY_ID = "__break__";
