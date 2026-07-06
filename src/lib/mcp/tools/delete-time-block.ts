import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./list-categories";

export default defineTool({
  name: "delete_time_block",
  title: "Delete a time block",
  description: "Delete a single time block by its id. This is irreversible.",
  inputSchema: {
    id: z.string().min(1).describe("Time block id to delete."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { error } = await supabaseForUser(ctx).from("time_blocks").delete().eq("id", id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Deleted ${id}` }], structuredContent: { id } };
  },
});
