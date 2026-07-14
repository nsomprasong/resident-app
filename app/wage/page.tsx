import { redirect } from "next/navigation";

/** Legacy route — replaced by HR payroll in Phase 18 */
export default function WageRedirectPage() {
  redirect("/hr/payroll");
}
