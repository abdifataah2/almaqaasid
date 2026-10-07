import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../shared";

export default defineTool({
  name: "get_student_results",
  title: "Get student results",
  description:
    "Get Term 1 results for a specific student by registration number. Returns subject, mark, and academic year.",
  inputSchema: {
    registration_number: z.string().trim().min(1).describe("Student registration number."),
    academic_year: z.string().optional().describe("Optional academic year filter, format YYYY-YYYY."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ registration_number, academic_year }, ctx: ToolContext) => {
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

    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("id, full_name, classes(name)")
      .eq("registration_number", registration_number)
      .maybeSingle();
    if (sErr) return { content: [{ type: "text", text: sErr.message }], isError: true };
    if (!student)
      return { content: [{ type: "text", text: "Student not found" }], isError: true };

    let q = supabase
      .from("results")
      .select("term1, academic_year, subjects(name)")
      .eq("student_id", (student as any).id);
    if (academic_year) q = q.eq("academic_year", academic_year);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const results = (data ?? []).map((r: any) => ({
      subject: r.subjects?.name,
      term1: r.term1,
      academic_year: r.academic_year,
    }));

    const payload = {
      student: {
        full_name: (student as any).full_name,
        class: (student as any).classes?.name ?? null,
        registration_number,
      },
      results,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
