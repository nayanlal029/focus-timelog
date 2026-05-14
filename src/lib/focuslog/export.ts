import ExcelJS from "exceljs";
import type { TimeBlock } from "./types";

export async function exportBlocksToXlsx(blocks: TimeBlock[], filename: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("FocusLog");
  ws.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Start Time", key: "start", width: 11 },
    { header: "End Time", key: "end", width: 11 },
    { header: "Duration (minutes)", key: "duration", width: 18 },
    { header: "Category", key: "category", width: 18 },
    { header: "Type", key: "type", width: 12 },
    { header: "Note", key: "note", width: 40 },
    { header: "Link", key: "link", width: 50 },
  ];
  ws.getRow(1).font = { bold: true };

  const sorted = blocks.slice().sort((a, b) => a.start - b.start);
  for (const b of sorted) {
    const start = new Date(b.start);
    const end = new Date(b.end);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const row = ws.addRow({
      date,
      start: start.toLocaleTimeString([], { hour12: false }),
      end: end.toLocaleTimeString([], { hour12: false }),
      duration: Math.round((b.end - b.start) / 60000),
      category: b.categoryName,
      type: b.type === "focus" ? "Focus" : b.type === "distraction" ? "Distraction" : "Neutral",
      note: b.note ?? "",
      link: b.link ?? "",
    });
    if (b.link) {
      const cell = row.getCell("link");
      cell.value = { text: b.link, hyperlink: b.link };
      cell.font = { color: { argb: "FF1F3A5F" }, underline: true };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
