import { getCurrentUser } from "@/lib/auth/current-user";
import {
  type Permission,
} from "@/lib/auth/authorization";

export type AuthorizationResult =
  | { status: "unauthenticated" }
  | { status: "unmapped" }
  | { status: "disabled" }
  | { status: "unknown_role" }
  | { status: "forbidden"; role: string }
  | {
      status: "authorized";
      role: string;
      currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
    };

export async function authorizeCurrentUser(
  permission: Permission,
): Promise<AuthorizationResult> {
  const currentUser = await getCurrentUser();

  if (!currentUser) return { status: "unauthenticated" };
  if (!currentUser.employee) return { status: "unmapped" };
  if (!currentUser.employee.isActive) return { status: "disabled" };

  const role = currentUser.employee.role ?? null;
  if (!role || !role.isActive) return { status: "unknown_role" };

  const permissions = role.permissions ?? [];
  if (!permissions.includes(permission)) {
    return { status: "forbidden", role: role.code };
  }

  return { status: "authorized", role: role.code, currentUser };
}
