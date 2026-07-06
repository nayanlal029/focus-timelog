import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./list-categories";

export default defineTool({
  name: "list_time_blocks",
  title: "List time blocks",
  description:
    "List the signed-in user's logged time blocks, newest first. Optionally filter by an inclusive ISO date range (YYYY-MM-DD) and limit the count (default 100, max 500).",
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive start date, YYYY-MM-DD."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive end date, YYYY-MM-DD."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows to return (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    let q = sb.from("time_blocks")
      .select("id,category_id,category_name,type,start_ms,end_ms,note,link,is_break")
      .order("start_ms", { ascending: false })
      .limit(limit ?? 100);
    if (from) q = q.gte("start_ms", Date.parse(`${from}T00:00:00`));
    if (to) q = q.lte("start_ms", Date.parse(`${to}T23:59:59.999`));
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { blocks: data ?? [] },
    };
  },
});
