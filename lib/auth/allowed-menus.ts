import { canAccessPageWithPermissions } from "@/lib/auth/authorization";
import { hrNavItems, selfNavItems } from "@/lib/hr/nav";

/** Navigable app paths shown in home/sidebar (excludes bare `/`). */
export const APP_MENU_PATHS: readonly string[] = [
  ...selfNavItems.map((item) => item.path),
  "/today",
  "/booking",
  "/foodOrder",
  "/kitchen",
  "/houseKeeperMinibar",
  "/dashboard",
  "/report",
  "/pos",
  ...hrNavItems.map((item) => item.path),
  "/settings",
  "/system/data-reset",
  "/system/audit-logs",
];

export function listAllowedMenuPaths(
  permissionCodes: readonly string[] | null | undefined,
): string[] {
  const permissions = permissionCodes ?? [];
  return APP_MENU_PATHS.filter((path) =>
    canAccessPageWithPermissions(permissions, path),
  );
}

export function hasAllowedMenus(
  permissionCodes: readonly string[] | null | undefined,
): boolean {
  return listAllowedMenuPaths(permissionCodes).length > 0;
}
