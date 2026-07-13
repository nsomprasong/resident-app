export type EmployeeRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  authUserId: string | null;
  roleId: string | null;
  roleCode: string | null;
  roleDisplayName: string | null;
  roleIsActive: boolean | null;
  isActive: boolean;
  mustResetPassword: boolean;
};
