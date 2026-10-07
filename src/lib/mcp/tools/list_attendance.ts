import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../shared";

export default defineTool({
  name: "list_attendance",
  title: "List attendance",
  description:
    "List attendance records for a given date, optionally filtered by class name. Returns student, class, status.",
  inputSchema: {
    date: z.string().describe("Attendance date in YYYY-MM-DD format."),
    class_name: z.string().optional().describe("Optional class name filter."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ date, class_name }, ctx: ToolContext) => {
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
      .from("attendance")
      .select("status, date, students(full_name, registration_number), classes(name)")
      .eq("date", date);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? [])
      .map((r: any) => ({
        full_name: r.students?.full_name,
        registration_number: r.students?.registration_number,
        class: r.classes?.name,
        status: r.status,
        date: r.date,
      }))
      .filter((r) => !class_name || (r.class ?? "").toLowerCase() === class_name.toLowerCase());

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { attendance: rows, count: rows.length },
    };
  },
});
