import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdmin } from "../shared";

export default defineTool({
  name: "list_fees",
  title: "List fees",
  description:
    "List fee records, optionally filtered by class name or payment status (paid/unpaid).",
  inputSchema: {
    class_name: z.string().optional().describe("Optional class name filter."),
    status: z.enum(["paid", "unpaid"]).optional().describe("Filter by payment status."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ class_name, status }, ctx: ToolContext) => {
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
      .from("fees")
      .select("amount, status, students(full_name, registration_number, classes(name))");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? [])
      .map((r: any) => ({
        full_name: r.students?.full_name,
        registration_number: r.students?.registration_number,
        class: r.students?.classes?.name,
        amount: r.amount,
        status: r.status,
      }))
      .filter((r) => !class_name || (r.class ?? "").toLowerCase() === class_name.toLowerCase())
      .filter((r) => !status || r.status === status);

    const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const paid = rows
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { fees: rows, count: rows.length, total_amount: total, paid_amount: paid },
    };
  },
});
