import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCategoriesTool from "./tools/list-categories";
import listTimeBlocksTool from "./tools/list-time-blocks";
import daySummaryTool from "./tools/day-summary";
import logTimeBlockTool from "./tools/log-time-block";
import deleteTimeBlockTool from "./tools/delete-time-block";

// The OAuth issuer MUST be the direct Supabase host. VITE_SUPABASE_PROJECT_ID
// is inlined at build time. Fallback keeps the issuer well-formed at manifest
// extract time; the published build inlines the real ref.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "focuslognl-mcp",
  title: "FocusLogNL",
  version: "0.1.0",
  instructions:
    "Read and log time blocks for the signed-in FocusLogNL user. Use `list_categories` to find category ids, `list_time_blocks` for entries in a date range, `day_summary` for daily totals, `log_time_block` to add a past entry, and `delete_time_block` to remove one.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCategoriesTool,
    listTimeBlocksTool,
    daySummaryTool,
    logTimeBlockTool,
    deleteTimeBlockTool,
  ],
});
