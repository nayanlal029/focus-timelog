import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./list-categories";

export default defineTool({
  name: "log_time_block",
  title: "Log a past time block",
  description:
    "Insert a completed time block for the signed-in user. Provide the category id (from list_categories) and start/end as ISO 8601 timestamps.",
  inputSchema: {
    categoryId: z.string().min(1).describe("Category id from list_categories."),
    startIso: z.string().describe("Start timestamp, ISO 8601."),
    endIso: z.string().describe("End timestamp, ISO 8601. Must be after startIso."),
    note: z.string().optional().describe("Optional note."),
    link: z.string().url().optional().describe("Optional URL associated with the block."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ categoryId, startIso, endIso, note, link }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const start = Date.parse(startIso);
    const end = Date.parse(endIso);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return { content: [{ type: "text", text: "Invalid start/end times" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: cat, error: catErr } = await sb
      .from("categories")
      .select("id,name,type")
      .eq("id", categoryId)
      .maybeSingle();
    if (catErr || !cat) return { content: [{ type: "text", text: catErr?.message ?? "Category not found" }], isError: true };
    const id = `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await sb.from("time_blocks").insert({
      id,
      user_id: ctx.getUserId()!,
      category_id: cat.id,
      category_name: cat.name,
      type: cat.type,
      start_ms: start,
      end_ms: end,
      note: note ?? null,
      link: link ?? null,
      is_break: false,
    }).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Logged ${cat.name} block (${Math.round((end - start) / 60000)} min).` }],
      structuredContent: { block: data },
    };
  },
});
