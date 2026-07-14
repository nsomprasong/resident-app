import { redirect } from "next/navigation";

/** Legacy route — replaced by HR schedules in Phase 18 */
export default function EmployeeScheduleRedirectPage() {
  redirect("/hr/schedules");
}
