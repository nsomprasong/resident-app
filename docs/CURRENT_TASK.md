# Current Task — Single Source of Truth

Last updated: 2026-07-12 (Asia/Bangkok)

## Phase / Task

- Phase 2 — Authorization และ RBAC
- Task 2.5 — Relational RBAC v2
- Current subphase: `Phase 3 — APPLICATION REFACTOR COMPLETED`
- Overall status: `PHASE 3 COMPLETED / AWAITING PHASE 4 APPROVAL`

## Approved Architecture Decision

ใช้ normalized relational RBAC และห้ามสร้าง Prisma/PostgreSQL `EmployeeRole` enum

Target model:

- `roles`
- `permissions`
- `role_permissions`
- nullable `employees.role_id`
- เก็บ `employees.role` ชั่วคราวระหว่าง migration

เหตุผล: รองรับ role expansion, localized display names, active/inactive roles และ database-managed permission mapping โดยไม่เปลี่ยน enum หรือ schema ทุกครั้งที่เพิ่ม role

## Final Schema for Review

### roles

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `code TEXT NOT NULL UNIQUE`
- `display_name TEXT NOT NULL`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP(3) NOT NULL`

Canonical seed records ตามลำดับ:

- `ADMIN`
- `MANAGER`
- `RECEPTION`
- `HOUSEKEEPING`
- `KITCHEN`
- `ACCOUNTING`

### permissions

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `code TEXT NOT NULL UNIQUE`
- `description TEXT NULL`
- `created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP(3) NOT NULL`

Permission records ต้องมาจากรายการใน `lib/auth/authorization.ts` เท่านั้น ห้ามเพิ่มหรือขยาย permission ระหว่าง migration

### role_permissions

- `role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE`
- `permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE`
- `created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
- composite primary key `(role_id, permission_id)`
- index `(permission_id)` สำหรับ reverse lookup

Matrix เริ่มต้นต้องถอดจาก `rolePermissions` ปัจจุบันแบบตรงตัว ห้าม broaden access

### employees

- เพิ่ม `role_id UUID NULL`
- foreign key `employees.role_id → roles.id` แบบ `ON DELETE SET NULL`
- เพิ่ม index `(role_id)`
- คง legacy `role TEXT NOT NULL` ไว้ใน migration นี้

`role_id = NULL` ต้อง fail closed ที่ HTTP/server authorization boundary

## Approved Migration Sequence

### Phase 1 — Design Schema (current)

1. ยืนยัน schema, constraints, canonical records และ mapping rules
2. ยังไม่แก้ Prisma Schema, migration หรือ database
3. รอ explicit approval ก่อน Phase 2

### Phase 2 — Additive Migration

1. Read-only preflight distinct/count ของ `employees.role`
2. หากพบ legacy/unknown value นอก verified mapping ให้หยุดและรายงาน
3. เพิ่ม `roles`, `permissions`, `role_permissions`
4. เพิ่ม nullable `employees.role_id` พร้อม foreign key/index
5. Insert canonical roles และ permissions แบบ idempotent
6. Insert role-permission matrix จาก current authorization behavior แบบตรงตัว
7. Backfill verified legacy values รวม `ผู้ดูแลระบบ → ADMIN`
8. เปลี่ยน `e2e-rbac-unknown` ให้เป็น valid Auth/Employee mapping ที่ `role_id = NULL`; ห้ามเพิ่ม `UNKNOWN_E2E` ใน `roles`
9. ไม่ drop หรือแก้ nullable ของ legacy `employees.role`
10. Verify FK invalid-reference rejection และ data reconciliation
11. หยุดรอ approval ก่อน Phase 3

### Phase 3 — Application Refactor

1. อ่าน role/permissions ผ่าน relations เป็น authoritative source
2. Missing/inactive role หรือ missing permission ต้อง fail closed
3. คง permission behavior เดิมทุก role
4. ปรับ API/page/navigation และ tests ให้ใช้ relational RBAC
5. Verify missing-role HTTP denial, known-role regression, lint, typecheck และ build
6. หยุดรอ approval ก่อน Phase 4

### Phase 4 — Legacy Cleanup

1. ตรวจว่าไม่มี code/read/write dependency ต่อ `employees.role`
2. ตรวจว่า Employee ที่ใช้งานต้องมี valid `role_id` ตาม policy ที่อนุมัติ
3. ขออนุมัติ destructive cleanup แยกต่างหาก
4. จึงสร้าง migration สำหรับ drop legacy column; ห้ามทำอัตโนมัติ

## Non-Negotiable Rules

- ห้ามสร้าง/apply enum
- ห้าม silently map unknown legacy roles
- ห้ามเพิ่ม `UNKNOWN_E2E` เป็น role
- ห้าม broaden permission matrix
- ห้าม drop `employees.role` ใน Phase 2
- ห้ามเริ่ม Phase ถัดไปโดยไม่มี explicit approval
- Source authorization behavior ปัจจุบันเป็น baseline ของ matrix

## Acceptance Criteria for Phase 1

- Target tables, columns, keys, indexes และ deletion behavior ระบุครบ
- Canonical role records ระบุครบ 6 roles
- Permission/matrix source ระบุว่า derive จาก current behavior เท่านั้น
- Backfill และ unknown-role handling ระบุชัด
- Migration/refactor/cleanup แยก approval boundary ชัดเจน
- ไม่มี schema/database mutation ก่อน approval

## Phase 2 Result

- Read-only preflight พบเฉพาะ verified values: canonical 5 role fixtures, `ผู้ดูแลระบบ` 2 และ `UNKNOWN_E2E` 1
- สร้าง/apply additive migration `20260712070648_relational_rbac_v2`
- Canonical roles: 6
- Permissions จาก current policy: 23
- Role-permission mappings: 68
- Employees ที่ backfill `role_id` สำเร็จ: 7
- `UNKNOWN_E2E` ที่คง `role_id = NULL`: 1
- Invalid `role_id` reference ถูก foreign key ปฏิเสธ: `PASSED`
- Legacy `employees.role` ยังอยู่ครบและไม่มี Employee ถูกลบ
- Prisma schema validation: `PASSED`
- Migration status: database schema up to date (8 migrations)
- TypeScript `--noEmit`: `PASSED`

## Current Blocker

ไม่มี blocker ปัจจุบันสำหรับ Phase 3 verification

## Phase 3 Result

- Middleware ใช้ active relational role และ database permissions เป็น authoritative boundary
- `/api/auth/me` ปฏิเสธ missing/inactive role และคืน role code/display name/permissions จากฐานข้อมูล
- Server authorization helper ใช้ relation แทน legacy role string
- Sidebar กรองเมนูจาก database permission list
- Missing-role HTTP/page fail-closed: `PASSED`
- Auth/RBAC policy/API/page regression: `18/18 PASSED`
- Lint: `PASSED`
- TypeScript `--noEmit`: `PASSED`
- Inactive-role E2E: `PASSED`
- Post-test reconciliation: `PASSED`
- Production build: `PASSED — manually confirmed 2026-07-12`
- Generic `npm run test`: `NOT APPLICABLE — package.json has no test script`

## Next Allowed Action

หยุดรอ explicit approval ก่อน Phase 4; ห้าม drop legacy `employees.role` หรือเริ่ม cleanup โดยอัตโนมัติ

## Latest Evidence

- Architecture decision บันทึกเป็น Relational RBAC v2
- Proposed enum migration ถูกยกเลิกและไม่ได้สร้าง/apply
- Phase 2 additive migration และ reconciliation ผ่านครบ
- Application Refactor implemented และ Phase 3 final verification ผ่านครบ
- ยังไม่ลบ legacy columnและยังไม่เริ่ม Phase 4
- Attempted Phase 3 final verification on 2026-07-12 แต่ command runner ไม่คืน exit status จึงยังไม่สามารถยืนยัน inactive-role E2E, reconciliation หรือ build
- Retried command runner smoke check on 2026-07-12 (`cmd /c cd`) แต่ยังไม่คืน exit status และไม่ปรากฏคำสั่งใน terminal output
- `npm run build`: `PASSED` จาก manual confirmation 2026-07-12
- `npm run test`: `NOT APPLICABLE` เพราะไม่มี `test` script ใน `package.json`
- `npx playwright test tests/e2e/rbac-inactive-role.spec.ts`: `1 passed`; inactive `RECEPTION` role ถูกปฏิเสธที่ HTTP boundary ด้วย `403`
- `npx tsx scripts/rbac-preflight.ts`: `PASSED`; roles `6`, permissions `23`, rolePermissions `68`, employeesWithRole `7`, employeesWithoutRole `1`, unknownFixtureWithoutRole `1`, invalidReferenceRejected `true`
