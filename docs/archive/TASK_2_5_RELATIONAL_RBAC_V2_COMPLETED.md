# Task 2.5 — Relational RBAC v2 Completed

Archived: 2026-07-12 (Asia/Bangkok)

## Status

- Phase 2 — Authorization / Relational RBAC: `COMPLETED`
- Task 2.5 — Relational RBAC v2: `COMPLETED`

## Result

- Normalized RBAC is authoritative via `roles`, `permissions`, `role_permissions`, and `employees.role_id`.
- Legacy `employees.role` was removed from Prisma schema and PostgreSQL database.
- One fixture with `role_id = NULL` was preserved for fail-closed coverage.

## Verified Evidence

- `npx prisma migrate deploy`: `PASSED`
- Migration `20260712153000_drop_legacy_employee_role`: `APPLIED`
- `npx prisma migrate status`: `PASSED — database schema is up to date, 9 migrations`
- `npx tsx scripts/rbac-preflight.ts`: `PASSED`
  - employees: `8`
  - roles: `6`
  - permissions: `23`
  - rolePermissions: `68`
  - employeesWithRole: `7`
  - employeesWithoutRole: `1`
  - invalidReferenceRejected: `true`
- `npx tsc --noEmit`: `PASSED`
- `npm run build`: `PASSED`
