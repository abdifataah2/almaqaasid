import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../shared";

export default defineTool({
  name: "list_students",
  title: "List students",
  description:
    "List students in the school, optionally filtered by class name. Returns registration number, full name, and class.",
  inputSchema: {
    class_name: z
      .string()
      .optional()
      .describe("Optional class name filter, e.g. 'Form 1' or 'Class 8'."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows to return (default 200)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ class_name, limit }, ctx: ToolContext) => {
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

    let query = supabase
      .from("students")
      .select("registration_number, full_name, classes(name)")
      .order("full_name")
      .limit(limit ?? 200);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? [])
      .map((s: any) => ({
        registration_number: s.registration_number,
        full_name: s.full_name,
        class: s.classes?.name ?? null,
      }))
      .filter((s) => !class_name || (s.class ?? "").toLowerCase() === class_name.toLowerCase());

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { students: rows, count: rows.length },
    };
  },
});
