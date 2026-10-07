import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Verify the authenticated MCP caller is an admin of this app.
 * Returns an error tool result if not; returns null when the caller is an admin.
 */
export async function requireAdmin(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    return {
      content: [{ type: "text" as const, text: "Not authenticated" }],
      isError: true as const,
    };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data, error } = await supabase.rpc("has_role", {
    _user_id: ctx.getUserId(),
    _role: "admin",
  });

  if (error) {
    return {
      content: [{ type: "text" as const, text: `Authorization check failed: ${error.message}` }],
      isError: true as const,
    };
  }
  if (!data) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Access denied: this MCP server is restricted to school admins.",
        },
      ],
      isError: true as const,
    };
  }
  return null;
}
