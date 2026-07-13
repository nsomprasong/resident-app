export type PermissionRecord = {
  id: string;
  code: string;
  description: string | null;
};

export type RolePermissionMapping = {
  roleId: string;
  roleCode: string;
  displayName: string;
  permissionCodes: string[];
};
