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

import {
  canAccessPageWithPermissions,
  employeeHasApiPermission,
  type ApiPermissionRequirement,
  type Permission,
} from "@/lib/auth/authorization";

export type EmployeeIdentity = {
  name: string;
  role: string;
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

export function EmployeePermissionsProvider({
  children,
}: {
  children: ReactNode;
}) {
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
          return;
        }
        const data = (await response.json()) as {
          employee?: EmployeeIdentity;
        };
        setEmployee(data.employee ?? null);
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
  }, []);

  const permissions = employee?.permissions ?? [];

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
    (pathname: string) => canAccessPageWithPermissions(permissions, pathname),
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
