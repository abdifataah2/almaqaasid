import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { requireAdmin } from "../shared";

export default defineTool({
  name: "list_classes",
  title: "List classes",
  description: "List all class levels in the school with student counts.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    const gate = await requireAdmin(ctx);
    if (gate) return gate;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const { data, error } = await supabase
      .from("classes")
      .select("id, name, students(count)")
      .order("name");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      student_count: c.students?.[0]?.count ?? 0,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { classes: rows },
    };
  },
});
