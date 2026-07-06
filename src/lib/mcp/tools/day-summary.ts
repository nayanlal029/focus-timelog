import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./list-categories";

export default defineTool({
  name: "day_summary",
  title: "Day summary",
  description:
    "Summarize total minutes spent on focus, distraction, neutral, and break categories for a given day (defaults to today, user local calendar in UTC).",
  inputSchema: {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Day to summarize, YYYY-MM-DD. Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const day = date ?? new Date().toISOString().slice(0, 10);
    const start = Date.parse(`${day}T00:00:00`);
    const end = Date.parse(`${day}T23:59:59.999`);
    const { data, error } = await supabaseForUser(ctx)
      .from("time_blocks")
      .select("type,start_ms,end_ms,is_break,category_name")
      .gte("start_ms", start)
      .lte("start_ms", end);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const totals = { focus: 0, distraction: 0, neutral: 0, break: 0 };
    const byCategory: Record<string, number> = {};
    for (const b of data ?? []) {
      const mins = Math.max(0, Math.round((b.end_ms - b.start_ms) / 60000));
      if (b.is_break) totals.break += mins;
      else totals[b.type as "focus" | "distraction" | "neutral"] += mins;
      byCategory[b.category_name] = (byCategory[b.category_name] ?? 0) + mins;
    }
    const summary = { date: day, totalsMinutes: totals, byCategoryMinutes: byCategory, entryCount: data?.length ?? 0 };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
