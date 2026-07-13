# Phase 16 — User / Role / Permission Management

## Goal

ทำให้ระบบจัดการ Authentication mapping, Employees, Roles และ Permissions
ใช้งานได้จากแอป โดยต่อยอด Relational RBAC ที่มีอยู่แล้ว
ไม่สร้างระบบสิทธิ์ซ้อนของเดิม

## Scope

1. Auth provider / session
2. Auth User ↔ Employee mapping
3. Employees CRUD (profile + role assignment)
4. Roles CRUD
5. Permissions catalog และ Role-Permission mapping
6. UI / route / API authorization ที่เกี่ยวข้อง
7. Disable user / reset password / session refresh (ตามที่ระบบรองรับ)

## Phase Rules

- ใช้ schema Relational RBAC ปัจจุบันเป็นฐาน
- Runtime authorization อ่านจาก DB (`roles` / `permissions` / `role_permissions`)
- ห้ามแก้ Phase 15
- ห้ามเปลี่ยน Single Role → Multiple Roles โดยไม่ขอ approval
- ห้าม destructive migration โดยไม่ขอ approval

## Tasks

**Phase 16 progress:** Task 16.6 `COMPLETED` — **Phase 16 COMPLETED**

### Task 16.1 — Authentication and RBAC Audit

Audit ระบบ Authentication, Users, Roles, Permissions และ authorization ที่เกี่ยวข้อง
จากโค้ดจริง เพื่อกำหนดแนวทาง implement

สถานะ: COMPLETED

### Task 16.2 — Roles CRUD

ทำให้จัดการ Roles ได้จริง (list / create / edit / activate-deactivate)
โดยไม่ขยายไป Users หรือ Permission matrix จนกว่า task นี้จะเสร็จ

สถานะ: COMPLETED

**Delivered:**
- API `GET/POST /api/roles`, `PATCH /api/roles/[roleId]` บังคับ `authorization.manage`
- code immutable หลังสร้าง; ปิดใช้งาน role ของตัวเองถูกปฏิเสธ
- Settings > Employees & Roles มี `RolesManager` (ADMIN เท่านั้นที่ mutate)
- Role ใหม่ยังไม่มี permissions จนกว่า Task permission mapping
- Verification: unit roles-validation, rbac-policy, rbac-cross-role (MANAGER/RECEPTION 403), auth-api-coverage, tsc

### Task 16.3 — Role-Permission Mapping

จัดการ permission catalog / ผูก permissions กับ role
(ตาม implementation order ใน Audit Results)

สถานะ: COMPLETED

**Delivered:**
- API `GET /api/permissions`
- API `GET/PUT /api/roles/[roleId]/permissions` บังคับ `authorization.manage`
- แทนที่ mapping ทั้งชุด; ปฏิเสธรหัสที่ไม่มีใน catalog
- กันถอด `authorization.manage` จาก role ของตัวเอง และกันถอดชุดสุดท้ายของระบบ
- UI ปุ่ม "สิทธิ์" ใน `RolesManager` (checkbox จาก catalog)
- Verification: unit role-permissions-validation, rbac-policy, auth-api-coverage, rbac-cross-role

### Task 16.4 — Employees CRUD

จัดการ Employee profile, ผูก `authUserId`, และ assign role
โดยยังไม่รวม invite/password reset เว้นแต่กำหนดใน task นั้น

สถานะ: COMPLETED

**Delivered:**
- API `GET/POST /api/employees`, `PATCH /api/employees/[employeeId]` บังคับ `employee.manage`
- ฟิลด์: name, phone, roleId, authUserId; ห้ามถอด Auth/role ของบัญชีตัวเอง
- กำหนดได้เฉพาะ role ที่ยัง active; authUserId ต้องเป็น UUID และ unique
- UI `EmployeesManager` ใน Settings (ADMIN); ถอด Auth = unlink mapping
- Verification: unit employees-validation, rbac-policy, auth-api-coverage, rbac-cross-role, tsc, lint

### Task 16.5 — Employee Soft-Disable

เพิ่มกลไกปิดใช้งานพนักงานโดยไม่ต้องถอด Auth mapping (เช่น `employees.is_active`)
และบังคับใน login/middleware

สถานะ: COMPLETED

**Delivered:**
- Migration `20260712220000_add_employee_is_active` (non-destructive, default true)
- `Employee.isActive` ใน schema + serialize/parse
- Login / middleware / `/api/auth/me` / `authorizeCurrentUser` fail-closed เมื่อ inactive
- UI ปุ่มเปิด-ปิดใน `EmployeesManager`; ห้ามปิดบัญชีตัวเอง
- Verification: unit, tsc, lint, rbac-policy, auth-api-coverage

### Task 16.6 — Phase 16 Integration Verification

ตรวจ regression ของ Auth/RBAC + Roles/Permissions/Employees ครบวงจร
ก่อนปิด Phase 16

สถานะ: COMPLETED

**Evidence (2026-07-12):**
- `npm run test:ci` (typecheck + lint + unit + build) — PASSED
- Auth/RBAC E2E (policy, cross-role, inactive-role, page-role, auth-*) — **91 passed**
- `npx tsx scripts/rbac-preflight.ts` — PASSED (roles 6, permissions 23, matrix 68, employees 8)
- Routes ใน build รวม `/api/roles`, `/api/permissions`, `/api/employees`
- นอกขอบเขตที่เหลือ: in-app invite / password reset (ต้อง approval แยกถ้าจะทำ)

## Phase 16 Completion Criteria

Phase 16 ถือว่าเสร็จเมื่อ:

- Roles CRUD ใช้งานได้จริง
- Role-Permission mapping ใช้งานได้จริงและมีผล runtime (DB-backed)
- Employees CRUD + auth mapping ใช้งานได้จริง
- Soft-disable พนักงานบังคับใน login/middleware
- API บังคับ `authorization.manage` / `employee.manage`
- Verification ครบและไม่มี regression สำคัญใน Auth/RBAC

**ผล Task 16.6:** ผ่านครบตามเกณฑ์ด้านบน

---

## Audit Results (Task 16.1)

**Audited:** 2026-07-12  
**Method:** targeted search + read ของ auth/RBAC schema, middleware, login, settings employees UI, auth APIs เท่านั้น  
**Constraint:** ไม่แก้ UI / API / schema / migration

### 1) ไฟล์ที่เกี่ยวข้อง

| Area | Paths |
|------|--------|
| Auth session / middleware | `middleware.ts`, `lib/supabase/middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/config.ts` |
| Current user | `lib/auth/current-user.ts`, `lib/auth/employee-authorization.ts` |
| Policy (static + route rules) | `lib/auth/authorization.ts` |
| Server authorize helper | `lib/auth/authorization-server.ts` (มีโค้ด แต่ยังไม่ถูกเรียกจาก route อื่น) |
| Login / logout / me | `app/login/actions.ts`, `app/login/LoginForm.tsx`, `app/login/page.tsx`, `app/api/auth/me/route.ts`, `app/api/auth/logout/route.ts` |
| Settings Employees UI | `app/settings/page.tsx` (ส่วน Employees & Roles — read-only) |
| Schema | `prisma/schema.prisma` (`Role`, `Permission`, `RolePermission`, `Employee`) |
| Migrations | `prisma/migrations/20260712070648_relational_rbac_v2`, `prisma/migrations/20260712153000_drop_legacy_employee_role` |
| Preflight | `scripts/rbac-preflight.ts` |
| UI nav guard | `components/layout/Sidebar.tsx` |
| Tests (auth/RBAC) | `tests/e2e/rbac-policy.spec.ts`, `rbac-cross-role.spec.ts`, `auth-*.spec.ts`, `auth-expiry.spec.ts`, `auth-revocation.spec.ts` |

### 2) Schema ที่มีอยู่

**Single Role ต่อ Employee** (ไม่ใช่ Multiple Roles):

- `Employee.roleId` → `Role?` (nullable FK, `onDelete: SetNull`)
- ไม่มีตาราง `user_roles` / join หลาย role ต่อคน

**ตาราง RBAC:**

- `Role`: `id`, `code` (unique), `displayName`, `isActive`, timestamps
- `Permission`: `id`, `code` (unique), `description?`, timestamps
- `RolePermission`: composite PK `(roleId, permissionId)`
- `Employee`: `id`, `authUserId?` (unique UUID → Supabase Auth user), `name`, `phone?`, `roleId?`, `hourlyRate?`, timestamps
- **ไม่มี** `Employee.isActive` / soft-disable flag บน employee

**ไม่มี Prisma model `User`** — identity อยู่ที่ Supabase Auth; app profile คือ `Employee`

Seed จาก migration `relational_rbac_v2`:

- 6 roles: `ADMIN`, `MANAGER`, `RECEPTION`, `HOUSEKEEPING`, `KITCHEN`, `ACCOUNTING`
- 23 permissions (ตรงกับ `lib/auth/authorization.ts` `permissions` const)
- Role-permission matrix ถูก seed ใน DB (preflight คาด `rolePermissions: 68`)

### 3) API ที่มีอยู่

| Endpoint | AuthZ | หมายเหตุ |
|----------|-------|----------|
| `GET /api/auth/me` | identity (authenticated + mapped employee + active role) | คืน name, role code, displayName, permissions[] |
| `POST /api/auth/logout` | public route ใน middleware | `signOut({ scope: "local" })` + audit `AUTH_LOGOUT` |
| `GET /api/health` | public | ไม่เกี่ยวกับ RBAC admin |

**ไม่มี** API สำหรับ:

- `/api/employees`, `/api/roles`, `/api/permissions`, role-permission mutate
- invite/create Supabase Auth user
- reset password
- disable/ban user

Middleware (`lib/supabase/middleware.ts`):

- ไม่มี JWT claims → pages redirect `/login`; APIs → `401`
- มี claims แต่ไม่มี Employee → `/access-denied` หรือ API `403`
- มี Employee แต่ role ว่าง/`!isActive` → `/forbidden` หรือ API `403`
- Pages: `canAccessPageWithPermissions(DB permissions, pathname)`
- APIs: `resolveApiPermission(method, pathname)` — ถ้า `null` หรือ permission ไม่อยู่ใน DB list → **fail-closed `403`**
- `/api/auth/me` เป็น `"identity"` (ไม่ต้องมี permission code เฉพาะ)

`authorizeCurrentUser` ใน `authorization-server.ts` อ่าน permission จาก DB เช่นเดียวกับ middleware แต่ **ยังไม่มี caller ใน app routes**

### 4) UI ที่มีอยู่

- Login: email/password → `signInWithPassword` แล้วตรวจ Employee mapping; ไม่มี mapping → signOut + error
- Settings > Employees & Roles: **read-only list** ชื่อ + `roleRecord.displayName` + นับ mapped/unmapped
- ไม่มี RolesManager / PermissionsManager / Employee form / invite / reset password UI
- Sidebar กรองเมนูจาก permissions ที่ได้จาก `/api/auth/me` (DB-backed)
- Pages `/employeeSchedule`, `/wage` ใช้ `employee.read` / `wage.read` ตาม page rules — แสดงข้อมูลพนักงานแต่ไม่ใช่ CRUD admin

### 5) สิ่งที่ทำงานแล้ว

- Supabase Auth เป็น auth provider (cookie session ผ่าน `@supabase/ssr`)
- Employee mapping บังคับทั้ง login และ middleware
- Relational RBAC ใน DB เป็น **authoritative** สำหรับ runtime page/API guards
- Role `isActive=false` หรือ `roleId=null` → deny
- Legacy `employees.role` string column **ถูกลบแล้ว** (migration `drop_legacy_employee_role`)
- Permission vocabulary + static matrix ใน `authorization.ts` สอดคล้อง seed DB (ใช้ใน policy tests / helpers)
- Page + API permission rules ครอบคลุม business APIs ปัจจุบัน (default deny เมื่อไม่ match)
- E2E auth/RBAC / revocation / optional wall-clock expiry มีอยู่

### 6) สิ่งที่ยังขาด

- Roles CRUD (UI + API + permission `authorization.manage`)
- Permissions catalog management / Role-Permission editor
- Employees CRUD (create/edit/link `authUserId`/assign role)
- In-app create Auth user / invite
- In-app disable user
- In-app reset password
- Employee `isActive` (หรือกลไก disable ที่ชัดเจนในแอป)
- API routes สำหรับ employee/role/permission (และลงทะเบียนใน `apiPermissionRules`)
- Settings Employees ส่วน mutate UI
- Sync automation ระหว่าง static `rolePermissions` ใน `authorization.ts` กับ DB matrix (ปัจจุบันต้องดูแลคู่กันด้วยมือ)
- Database RLS policies (ไม่พบใน Prisma migrations)

### 7) Single Role หรือ Multiple Roles

**Single Role** — ยืนยันจาก schema: `Employee.roleId` ชี้ Role เดียว  
การเปลี่ยนเป็น Multiple Roles ต้องขอ approval ตาม Approval Policy ของ Task 16.1

### 8) วิธีสร้าง User ปัจจุบัน

ไม่มี flow ในแอป หลักฐานจาก docs/fixture setup + schema:

1. สร้าง user ใน Supabase Auth (Dashboard / Auth API ภายนอกแอป)
2. Insert/update `employees` ให้ `auth_user_id` = Auth UUID
3. ตั้ง `role_id` ชี้ไปยัง `roles.id` ที่ต้องการ

`prisma/seed.ts` ไม่ seed employees/roles (ใช้ SSL connection อย่างอื่น) — RBAC seed อยู่ใน migration

### 9) วิธี Disable User

**ไม่มี first-class disable ในแอป**

ทางที่เป็นไปได้จากโค้ดปัจจุบัน (operational, ไม่ใช่ product feature):

- ถอด `authUserId` / ไม่ map Employee → login ถูกปฏิเสธ / middleware → access-denied
- ตั้ง `roleId = null` หรือ `roles.is_active = false` → forbidden (หมายเหตุ: deactivate role มีผลกับทุก employee ที่ใช้ role นั้น)
- Ban/disable ที่ Supabase Auth (นอกแอป — ไม่มีโค้ดเรียก admin API)

### 10) วิธี Reset Password

**ไม่มีในแอป** — ต้องใช้ Supabase Auth (Dashboard / recovery email flow ของ provider)  
ไม่พบ `resetPasswordForEmail`, `updateUser`, หรือ service-role admin calls ใน source

### 11) วิธี refresh Session

- Middleware สร้าง Supabase SSR client และเรียก `supabase.auth.getClaims()` — refresh/persist cookies ผ่าน `setAll` บน response
- `lib/supabase/server.ts` ตั้งใจไม่บังคับเขียน cookie จาก Server Components (comment ระบุให้ middleware เป็น refresh boundary)
- Logout: `POST /api/auth/logout` → `signOut({ scope: "local" })`
- E2E `auth-expiry.spec.ts` ตรวจ refresh_token ของ Supabase โดยตรง (optional flag); `auth-revocation.spec.ts` ตรวจ global revoke

### 12) Legacy Role mapping

- คอลัมน์ `employees.role` (string) **ถูก drop แล้ว** — ไม่ใช่ source of truth อีกต่อไป
- Backfill ใน `relational_rbac_v2` map ค่าไทย/`ADMIN`/… → `role_id`; fixture ที่ไม่รู้จัก (เช่น `UNKNOWN_E2E`) คง `role_id = NULL` เพื่อ fail-closed
- `resolveRole` / `roleAliases` ใน `authorization.ts` ยังมี alias ภาษาไทย + code สำหรับ **static helpers/tests** (`canAccessPage`, `hasPermission`) — **runtime middleware ไม่ใช้ alias นี้** แต่ใช้ `roles.code` + permission codes จาก DB

### 13) Migration ที่จำเป็น (สำหรับงานถัดไป — ยังไม่สร้างใน Task 16.1)

จากช่องว่างของ schema/feature (ยังไม่ implement):

| Need | Migration? | หมายเหตุ |
|------|------------|----------|
| Roles CRUD บนตาราง `roles` ที่มีอยู่ | อาจไม่ต้อง | ใช้ `isActive` / `displayName` / `code` ได้แล้ว; ระวัง unique `code` และ seed roles |
| Role-Permission editor | อาจไม่ต้อง | ใช้ `role_permissions` ได้แล้ว |
| Employee soft-disable | **น่าจะต้อง** | เพิ่ม `employees.is_active` (หรือเทียบเท่า) ถ้าต้องการ disable โดยไม่ถอด auth map |
| Multiple roles per employee | **ต้อง + breaking** | ต้อง approval — อยู่นอกแนวทางปัจจุบัน |
| Link metadata / invite state | อาจต้อง | ถ้ารองรับ invite/pending mapping ในแอป |
| RLS | แยกตัดสินใจ | ปัจจุบันพึ่ง app middleware + Prisma; ไม่มี RLS ใน migrations |

Task 16.2 (Roles CRUD) น่าจะเริ่มได้บน schema ปัจจุบันโดยไม่บังคับ migration ใหม่ — ยืนยันอีกครั้งตอนออกแบบ API

### 14) Security risks

1. **Dual matrix:** static `rolePermissions` ใน `authorization.ts` กับ DB `role_permissions` อาจคลาดเคลื่อน; runtime ใช้ DB แต่ tests/helpers ใช้ static
2. **ไม่มี employee disable ชัดเจน:** ถอด map / ปิดทั้ง role มี side effect หรือหลุด operational
3. **ไม่มี in-app user provisioning:** พึ่ง manual Supabase + SQL → ความผิดพลาดของ mapping / orphan auth users
4. **`authorization.manage` / `employee.manage` ยังไม่มี API surface:** สิทธิ์มีใน matrix แต่ยังไม่ถูก enforce ผ่าน mutate endpoints (ยังไม่มี endpoints)
5. **Settings Employees เป็น read-only ภายใต้ `settings.manage`:** ผู้มี settings เห็นรายชื่อพนักงาน แต่ยังไม่มี mutate; เมื่อมี CRUD ต้องแยก `employee.manage` / `authorization.manage` ให้ชัด
6. **ไม่พบ DB RLS:** ถ้ามี DB credential หลุดนอกแอป จะไม่มี row-level deny จาก policies ใน repo
7. **API default deny ดีแล้ว** แต่ endpoint ใหม่ที่ลืมใส่ `apiPermissionRules` จะได้ 403 ทั้งระบบจนกว่าจะลงทะเบียน — ต้องเป็น checklist ของทุก task ถัดไป
8. **`authorizeCurrentUser` ยังไม่ถูกใช้ใน handlers:** พึ่ง middleware เป็นหลัก; handler ที่ข้าม middleware pattern ในอนาคตต้องเรียก helper เอง

### 15) Implementation order จากโค้ดจริง

ลำดับที่ลดความเสี่ยงและต่อยอดของที่มีอยู่ (ไม่เปลี่ยน architecture):

1. **Task 16.2 — Roles CRUD**  
   ตาราง `roles` พร้อม `isActive`; ยังไม่มี UI/API; permission เป้าหมาย `authorization.manage` (ADMIN เท่านั้นตาม matrix)
2. **Permissions read + Role-Permission mapping UI/API**  
   ใช้ `permissions` / `role_permissions`; ยังไม่ต้อง invent permission codes ใหม่ถ้าไม่จำเป็น
3. **Employees CRUD + authUserId link + role assignment**  
   ใช้ schema ปัจจุบัน; enforce `employee.manage`; แยกจาก `settings.manage`
4. **Disable / deactivate employee**  
   ออกแบบกลไก (แนะนำ `is_active` บน employee) + ตรวจ login/middleware
5. **Auth user provisioning / password reset (ถ้าอยู่ใน scope Phase 16)**  
   ต้อง service role / Supabase Admin — architecture ที่กระทบ secret boundary → ขอ approval ถ้าเกิน cookie/public client ปัจจุบัน
6. **Reconcile static policy helpers กับ DB**  
   ลด dual-source drift (tests อ่าน DB หรือ generate จากแหล่งเดียว)
7. **Regression:** rbac-preflight, auth/RBAC E2E, ลงทะเบียน `apiPermissionRules` / page rules ที่เกี่ยวข้อง

**ไม่เริ่ม Multiple Roles และไม่เริ่ม RLS ในลำดับนี้โดยอัตโนมัติ**

### 16) Auth provider / Session / Token claims (สรุป)

| Item | Evidence |
|------|----------|
| Provider | Supabase Auth |
| Login | `signInWithPassword` |
| Session check (edge/middleware) | `getClaims()` → `claims.sub` = auth user id |
| App identity | `Employee` where `authUserId = sub` |
| Authorization source | `employee.roleRecord.permissions[].permission.code` จาก DB |
| UI authorization | Sidebar filter + page middleware |
| Route authorization | middleware page permission rules |
| API authorization | middleware `resolveApiPermission` + DB permission membership |
| RLS | ไม่มีใน Prisma migrations ของ repo นี้ |
