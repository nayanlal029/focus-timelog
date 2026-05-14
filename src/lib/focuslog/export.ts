import * as XLSX from "xlsx";
import type { TimeBlock } from "./types";

export function exportBlocksToXlsx(blocks: TimeBlock[], filename: string) {
  const rows = blocks
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((b) => {
      const start = new Date(b.start);
      const end = new Date(b.end);
      const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      return {
        Date: date,
        "Start Time": start.toLocaleTimeString([], { hour12: false }),
        "End Time": end.toLocaleTimeString([], { hour12: false }),
        "Duration (minutes)": Math.round((b.end - b.start) / 60000),
        Category: b.categoryName,
        Type: b.type === "focus" ? "Focus" : b.type === "distraction" ? "Distraction" : "Neutral",
        Note: b.note ?? "",
      };
    });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FocusLog");
  XLSX.writeFile(wb, filename);
}
