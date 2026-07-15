export type EmployeeRecord = {
  id: string;
  name: string;
  /** @deprecated Prefer username/phone for new employees; kept for legacy email Auth. */
  email: string | null;
  username: string | null;
  phone: string | null;
  authUserId: string | null;
  roleId: string | null;
  roleCode: string | null;
  roleDisplayName: string | null;
  roleIsActive: boolean | null;
  isActive: boolean;
  /** Same meaning as mustChangePassword in the new login brief. */
  mustResetPassword: boolean;
  /** True when employee still relies on email Auth (legacy). */
  usesEmailLogin: boolean;
};
