"use client";

import type { ReactNode } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import type { Permission } from "@/lib/auth/authorization";

type PermissionGateProps = {
  /** Require a single permission */
  permission?: Permission;
  /** Require any one of these permissions */
  anyOf?: readonly Permission[];
  /** Require access to a page path (uses page permission rules) */
  path?: string;
  children: ReactNode;
  /** Shown when denied or still loading (default: hide) */
  fallback?: ReactNode;
  /**
   * While permissions load, show children (default false = hide to avoid
   * flashing unauthorized buttons).
   */
  showWhileLoading?: boolean;
};

/**
 * Hide UI the current employee cannot use.
 * Server/middleware remain the security boundary; this is for UX only.
 */
export function PermissionGate({
  permission,
  anyOf,
  path,
  children,
  fallback = null,
  showWhileLoading = false,
}: PermissionGateProps) {
  const { loaded, can, canAny, canAccessPath } = useEmployeePermissions();

  if (!loaded) {
    return <>{showWhileLoading ? children : fallback}</>;
  }

  if (permission && !can(permission)) {
    return <>{fallback}</>;
  }
  if (anyOf && anyOf.length > 0 && !canAny(anyOf)) {
    return <>{fallback}</>;
  }
  if (path && !canAccessPath(path)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
