import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStudents from "./tools/list_students";
import listClasses from "./tools/list_classes";
import getStudentResults from "./tools/get_student_results";
import listAttendance from "./tools/list_attendance";
import listFees from "./tools/list_fees";

// The OAuth issuer must be the direct supabase.co host, not the .lovable.cloud proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "almaqaasid-mcp",
  title: "Al-Maqaasid School MCP",
  version: "0.1.0",
  instructions:
    "Read-only access to Al-Maqaasid School data for authenticated admins: students, classes, results (Term 1), attendance, and fees. Requires the signed-in user to have the admin role.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listStudents, listClasses, getStudentResults, listAttendance, listFees],
});
