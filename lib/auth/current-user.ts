import { findEmployeeAuthorization } from "@/lib/auth/employee-authorization";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const employee = await findEmployeeAuthorization(user.id);

  return { user, employee };
}
