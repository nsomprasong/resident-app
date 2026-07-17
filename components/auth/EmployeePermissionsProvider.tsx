"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  isAccessDenialCode,
  type AccessDenialCode,
} from "@/lib/auth/access-denial";
import { hasAllowedMenus } from "@/lib/auth/allowed-menus";
import {
  canAccessPageWithPermissions,
  employeeHasApiPermission,
  type ApiPermissionRequirement,
  type Permission,
} from "@/lib/auth/authorization";

export type EmployeeIdentity = {
  name: string;
  role: string | null;
  roleDisplayName: string;
  permissions: string[];
};

type EmployeePermissionsContextValue = {
  employee: EmployeeIdentity | null;
  permissions: readonly string[];
  loaded: boolean;
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
  canRequirement: (required: ApiPermissionRequirement) => boolean;
  canAccessPath: (pathname: string) => boolean;
};

const EmployeePermissionsContext =
  createContext<EmployeePermissionsContextValue | null>(null);

function normalizeEmployee(raw: unknown): EmployeeIdentity | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const permissionsRaw = record.permissions;
  const permissions = Array.isArray(permissionsRaw)
    ? permissionsRaw.filter(
        (code): code is string => typeof code === "string" && code.length > 0,
      )
    : [];

  const role =
    typeof record.role === "string" && record.role.length > 0
      ? record.role
      : null;

  return {
    name: typeof record.name === "string" ? record.name : "",
    role,
    roleDisplayName:
      typeof record.roleDisplayName === "string" ? record.roleDisplayName : "",
    permissions,
  };
}

export function EmployeePermissionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeIdentity | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          setEmployee(null);
          if (response.status === 403) {
            const body = (await response.json().catch(() => null)) as {
              code?: string;
            } | null;
            const code = body?.code;
            const currentPath =
              typeof window !== "undefined" ? window.location.pathname : "";
            if (
              isAccessDenialCode(code) &&
              currentPath !== "/access-denied" &&
              currentPath !== "/login" &&
              currentPath !== "/set-password"
            ) {
              router.replace(
                `/access-denied?reason=${encodeURIComponent(code as AccessDenialCode)}`,
              );
            }
          }
          return;
        }
        const data = (await response.json()) as { employee?: unknown };
        const normalized = normalizeEmployee(data.employee);
        const permissions = normalized?.permissions ?? [];
        const role = normalized?.role ?? null;

        if (!normalized || !role || permissions.length === 0) {
          setEmployee(null);
          const currentPath =
            typeof window !== "undefined" ? window.location.pathname : "";
          if (
            currentPath !== "/access-denied" &&
            currentPath !== "/login" &&
            currentPath !== "/set-password"
          ) {
            const reason: AccessDenialCode = !normalized
              ? "EMPLOYEE_NOT_FOUND"
              : !role
                ? "ROLE_NOT_ASSIGNED"
                : "PERMISSIONS_EMPTY";
            router.replace(
              `/access-denied?reason=${encodeURIComponent(reason)}`,
            );
          }
          return;
        }

        if (!hasAllowedMenus(permissions)) {
          setEmployee(null);
          const currentPath =
            typeof window !== "undefined" ? window.location.pathname : "";
          if (
            currentPath !== "/access-denied" &&
            currentPath !== "/login" &&
            currentPath !== "/set-password"
          ) {
            router.replace(
              `/access-denied?reason=${encodeURIComponent("PERMISSIONS_EMPTY")}`,
            );
          }
          return;
        }

        setEmployee(normalized);
      } catch {
        if (!controller.signal.aborted) {
          setEmployee(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoaded(true);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [router]);

  const permissions = useMemo(
    () => employee?.permissions ?? [],
    [employee?.permissions],
  );

  const can = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions],
  );

  const canAny = useCallback(
    (codes: readonly Permission[]) =>
      codes.some((code) => permissions.includes(code)),
    [permissions],
  );

  const canRequirement = useCallback(
    (required: ApiPermissionRequirement) =>
      employeeHasApiPermission(permissions, required),
    [permissions],
  );

  const canAccessPath = useCallback(
    (path: string) => canAccessPageWithPermissions(permissions, path),
    [permissions],
  );

  const value = useMemo(
    () => ({
      employee,
      permissions,
      loaded,
      can,
      canAny,
      canRequirement,
      canAccessPath,
    }),
    [employee, permissions, loaded, can, canAny, canRequirement, canAccessPath],
  );

  return (
    <EmployeePermissionsContext.Provider value={value}>
      {children}
    </EmployeePermissionsContext.Provider>
  );
}

export function useEmployeePermissions(): EmployeePermissionsContextValue {
  const context = useContext(EmployeePermissionsContext);
  if (!context) {
    throw new Error(
      "useEmployeePermissions must be used within EmployeePermissionsProvider",
    );
  }
  return context;
}

/** Safe for optional probes (error logger) — never throws. */
export function useEmployeePermissionsOptional(): EmployeePermissionsContextValue | null {
  return useContext(EmployeePermissionsContext);
}
