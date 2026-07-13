# MASTER PLAN — Resident Hotel Management

> Single long-term project roadmap.
>
> This file defines the approved implementation order for the entire project.
>
> Read this file ONLY when:
>
> - `docs/CURRENT_TASK.md` has no next task.
> - A phase has been completed.
> - The user requests roadmap planning.
>
> During normal implementation:
>
> DO NOT read this file.
>
> During normal implementation:
>
> Read only:
>
> 1. AGENTS.md
> 2. CURRENT_TASK.md
> 3. Relevant source code

---

# Project Principles

This project follows these rules.

- Small reversible changes
- Security first
- Server is authoritative
- Database is source of truth
- Backward compatibility unless explicitly approved
- No unrelated refactor
- Minimize token usage
- Minimize Codex/Cursor credits
- One active task only

---

# Phase Overview

| Phase | Name | Status |
|--------|------|--------|
| 0 | Foundation | ✅ Completed |
| 1 | Authentication | ✅ Completed |
| 2 | Authorization / Relational RBAC | ✅ Completed |
| 3 | Runtime Validation & Error Contract | ⏳ Pending |
| 4 | Audit Log | ⏳ Pending |
| 5 | Booking Integrity | ⏳ Pending |
| 6 | Payment / Refund Integrity | ⏳ Pending |
| 7 | Automated Testing & CI | ⏳ Pending |
| 8 | Dashboard | ⏳ Pending |
| 9 | Master Data / Settings | ⏳ Pending |
| 10 | Kitchen Workflow | ⏳ Pending |
| 11 | Employee / Schedule / Wage | ⏳ Pending |
| 12 | Reports / Receipt / Export | ⏳ Pending |
| 13 | Production Readiness | ⏳ Pending |

---

# Phase 0

## Goal

Project foundation

## Includes

- Repository
- Documentation
- Prisma
- Supabase
- Basic architecture

## Status

Completed

---

# Phase 1

## Goal

Authentication

## Includes

- Login
- Session
- Employee Mapping
- Auth Middleware

## Status

Completed

---

# Phase 2

## Goal

Authorization

## Includes

- Relational RBAC
- Roles
- Permissions
- Role Permissions
- Role migration
- Middleware authorization
- Navigation authorization
- Legacy cleanup

## Exit Criteria

- Relational RBAC is authoritative
- Legacy role removed
- Build passed
- TypeScript passed

## Status

Completed

---

# Phase 3

## Goal

Runtime Validation

## Objective

Every server mutation must validate input.

## Includes

- Shared validation layer
- Common error contract
- Runtime validation
- API consistency

## Must Not

- Change business logic
- Change RBAC
- Change UI

## Exit Criteria

- All mutations validated
- Error format unified
- No duplicate validation

---

# Phase 4

## Goal

Audit Log

## Includes

- Authentication events
- Booking events
- Payment events
- Refund events
- Employee actions

## Exit Criteria

- Sensitive actions audited
- Audit entries immutable

---

# Phase 5

## Goal

Booking Integrity

## Includes

- Availability
- Concurrency
- Transactions
- Conflict detection

---

# Phase 6

## Goal

Payment Integrity

## Includes

- Partial payment
- Refund
- Financial consistency
- Transaction safety

---

# Phase 7

## Goal

Testing

## Includes

- Unit tests
- Integration tests
- E2E
- CI

---

# Phase 8

## Goal

Dashboard

## Includes

- Manager dashboard
- Occupancy
- Revenue
- Housekeeping overview

---

# Phase 9

## Goal

Master Data

## Includes

- Settings
- Room Types
- Zones
- Packages
- Products
- Employees

---

# Phase 10

## Goal

Kitchen Workflow

## Includes

- Orders
- Preparation
- Status
- Delivery

---

# Phase 11

## Goal

Employee Management

## Includes

- Schedule
- Wage
- Attendance

---

# Phase 12

## Goal

Reports

## Includes

- Receipt
- Revenue
- Occupancy
- Export

---

# Phase 13

## Goal

Production Readiness

## Includes

- Security review
- Performance
- Backup
- Monitoring
- Deployment
- Disaster recovery

---

# Rules

Never skip phases unless explicitly approved.

Do not reprioritize.

Do not invent new phases.

Do not merge phases.

When CURRENT_TASK is completed:

1. Read this file.
2. Select the next pending phase.
3. Wait for approval.
4. Create the next CURRENT_TASK.

---

# Token Optimization

This file intentionally contains only:

- roadmap
- dependencies
- progress

It must never duplicate:

- CURRENT_TASK.md
- PROJECT_CONTEXT.md
- AGENTS.md
- reference documents

---

# Current Progress

Completed

- Phase 15 — Master Data Management (Tasks 15.1–15.10)
- Phase 16 — User / Role / Permission Management (Tasks 16.1–16.6)
- Phase 17 — Employee Auth Linking & Permission Localization (Tasks 17.1–17.4)

Current

- Phase 17 COMPLETED — awaiting approval to define/start next phase

MASTER_PLAN determines only the next phase.

It never authorizes implementation.

Implementation always requires a new CURRENT_TASK
and explicit approval.

---

# Phase 15 — Master Data Management

## Goal

เปลี่ยนหน้า Settings > Master Data จากหน้าสำหรับแสดงข้อมูลอย่างเดียว
ให้เป็นระบบจัดการข้อมูลหลักที่สามารถเพิ่ม แก้ไข เปิด/ปิดการใช้งาน
และตรวจสอบความถูกต้องของข้อมูลได้จริง

## Scope

Phase นี้ครอบคลุมข้อมูลหลักที่ใช้ร่วมกันในระบบ ได้แก่:

1. Room Types
2. Zones / Buildings
3. Rooms
4. Rafts
5. Products
6. Inspection Catalog
7. Payment Channels
8. ข้อมูลหลักอื่นที่แสดงอยู่ในหน้า Master Data ปัจจุบัน

## Implementation Strategy

ดำเนินงานทีละโมดูล โดยใช้รูปแบบ CRUD และ UI pattern เดียวกันให้มากที่สุด:

- List
- Create
- Edit
- Activate / Deactivate
- Validation
- Error handling
- Loading state
- Empty state
- Permission enforcement
- Verification

ต้องสร้าง shared component หรือ shared helper เฉพาะเมื่อมีการใช้งานซ้ำจริง
และต้องไม่ refactor ส่วนอื่นที่ไม่เกี่ยวข้องกับ Phase 15

## Phase Rules

- ห้ามแก้ไขฟีเจอร์นอกขอบเขต Master Data
- ห้าม redesign ระบบเดิมทั้งหมด
- ใช้ database schema และ API pattern เดิมก่อนสร้าง abstraction ใหม่
- อ่านเฉพาะไฟล์ที่เกี่ยวข้องกับ Task ปัจจุบัน
- หลีกเลี่ยง repository-wide scan หากไม่จำเป็น
- ทำงานต่อเนื่องจนจบ Task ย่อยและ verification ก่อนหยุด
- ไม่ต้องขออนุมัติระหว่างขั้นตอนภายใน Task เดียวกัน
- ขออนุมัติเฉพาะเมื่อ:
  - ต้องเปลี่ยน database schema ที่มีผลกระทบสูง
  - ต้องลบข้อมูลหรือทำ destructive migration
  - ต้องเปลี่ยน architecture หลัก
  - พบ requirement ที่ตัดสินใจแทนผู้ใช้ไม่ได้

## Tasks

**Phase 15 progress:** Task 15.10 `COMPLETED` — **Phase 15 COMPLETED**

### Task 15.1 — Master Data Audit and CRUD Foundation

ตรวจสอบหน้า Master Data ปัจจุบัน ตั้งแต่ UI, API, service และ database
จากนั้นกำหนด CRUD pattern กลางสำหรับใช้กับทุกโมดูล

Deliverables:

- รายการ Master Data modules ที่มีอยู่จริง
- ระบุว่าแต่ละโมดูลใช้ table/API ใด
- ระบุสิ่งที่มีอยู่แล้วและสิ่งที่ยังขาด
- CRUD UI pattern
- Modal/Form pattern
- Validation and error pattern
- Permission pattern
- แผนงานย่อยของ Phase 15 ที่ยืนยันจากโค้ดจริง

สถานะ: COMPLETED

---

### Task 15.2 — Room Types CRUD

ทำให้ผู้ใช้สามารถ:

- ดูรายการประเภทห้อง
- เพิ่มประเภทห้อง
- แก้ไขชื่อ รายละเอียด จำนวนผู้เข้าพัก ประเภทเตียง และราคา
- เปิด/ปิดการใช้งาน
- ป้องกันข้อมูลซ้ำหรือข้อมูลไม่ครบ
- เห็นผลการแก้ไขทันทีหลังบันทึก

สถานะ: COMPLETED

---

### Task 15.3 — Zones and Buildings CRUD

ทำให้ผู้ใช้สามารถ:

- เพิ่มโซนหรืออาคาร
- แก้ไขชื่อและรายละเอียด
- เปิด/ปิดการใช้งาน
- ป้องกันการปิดข้อมูลที่ยังมีห้องใช้งานอยู่โดยไม่แจ้งเตือน
- ดูจำนวนห้องของแต่ละโซนหรืออาคาร

สถานะ: COMPLETED

---

### Task 15.4 — Rooms CRUD

ทำให้ผู้ใช้สามารถ:

- เพิ่มห้อง
- แก้ไขเลขห้อง ชื่อ อาคาร/โซน และประเภทห้อง
- กำหนดสถานะเปิดใช้งาน
- ตรวจสอบเลขห้องซ้ำ
- ป้องกันความสัมพันธ์ข้อมูลที่ไม่ถูกต้อง
- แสดงผลห้องใหม่หรือข้อมูลที่แก้ไขในระบบจอง

สถานะ: COMPLETED

---

### Task 15.5 — Rafts CRUD

ทำให้ผู้ใช้สามารถ:

- เพิ่มแพ
- แก้ไขชื่อหรือหมายเลขแพ
- กำหนดความจุและข้อมูลที่เกี่ยวข้อง
- เปิด/ปิดการใช้งาน
- ตรวจสอบข้อมูลซ้ำ
- แสดงผลในส่วนการจองที่เกี่ยวข้อง

สถานะ: COMPLETED

---

### Task 15.6 — Products CRUD

ทำให้ผู้ใช้สามารถ:

- เพิ่มสินค้า
- แก้ไขชื่อ หมวดหมู่ หน่วย และราคา
- เปิด/ปิดการใช้งาน
- ตรวจสอบข้อมูลจำเป็น
- รองรับการนำสินค้าไปใช้ในหน้าที่เกี่ยวข้อง

สถานะ: COMPLETED

---

### Task 15.7 — Inspection Catalog CRUD

ทำให้ผู้ใช้สามารถ:

- เพิ่มรายการตรวจสอบ
- แก้ไขชื่อ หมวดหมู่ หน่วย และราคากลาง
- เปิด/ปิดการใช้งาน
- ตรวจสอบข้อมูลซ้ำ
- รองรับการใช้งานร่วมกับขั้นตอนตรวจห้องหรือคิดค่าเสียหาย

สถานะ: COMPLETED

---

### Task 15.8 — Payment Channels CRUD

ทำให้ผู้ใช้สามารถ:

- เพิ่มช่องทางรับชำระ
- แก้ไขชื่อ ประเภท และข้อมูลที่จำเป็น
- เปิด/ปิดการใช้งาน
- ป้องกันการปิดช่องทางที่ระบบกำลังใช้งานโดยไม่มีคำเตือน
- แสดงเฉพาะช่องทางที่เปิดใช้งานในหน้ารับชำระเงิน

สถานะ: COMPLETED

---

### Task 15.9 — Master Data Permission Enforcement

กำหนดสิทธิ์ให้ชัดเจนว่า:

- ผู้ดูแลระบบสามารถเพิ่มและแก้ไขได้
- ผู้จัดการเข้าถึงได้ตาม permission ที่กำหนด
- ผู้ใช้งานที่ไม่มีสิทธิ์ดูได้อย่างเดียวหรือเข้าไม่ได้
- API ต้องตรวจสิทธิ์จริง ไม่พึ่งเฉพาะการซ่อนปุ่มใน UI

สถานะ: COMPLETED

---

### Task 15.10 — Integration and Regression Verification

ตรวจสอบการเชื่อมโยง Master Data กับระบบทั้งหมด ได้แก่:

- ระบบจอง
- การเลือกห้องและแพ
- สินค้า
- การตรวจห้อง
- การรับชำระเงิน
- รายงานที่เกี่ยวข้อง
- Permission
- Loading, empty, validation และ error states

ต้องแก้เฉพาะ regression ที่เกิดจาก Phase 15
และไม่ขยายขอบเขตไปยังฟีเจอร์ใหม่

สถานะ: COMPLETED

---

## Phase 15 Completion Criteria

Phase 15 จะถือว่าเสร็จเมื่อ:

- Master Data ทุกโมดูลในขอบเขตสามารถจัดการได้จริง
- Create และ Edit บันทึกลงฐานข้อมูลจริง
- การเปิด/ปิดข้อมูลมีผลในหน้าที่นำข้อมูลไปใช้งาน
- Validation และ error message ใช้งานได้
- API permission ถูกบังคับใช้
- ไม่มี regression สำคัญในระบบจองและรับชำระเงิน
- เอกสารสถานะและ verification ถูกอัปเดตครบ

**ผล Task 15.10:** ผ่านครบตามเกณฑ์ด้านบน (evidence ใน docs/CURRENT_TASK.md)

---

# Phase 16 — User / Role / Permission Management

## Goal

จัดการ Authentication mapping, Employees, Roles และ Permissions
โดยต่อยอด Relational RBAC ที่มีอยู่แล้ว ไม่สร้างระบบสิทธิ์ซ้อนของเดิม

## Scope

- Auth provider / session
- Auth User ↔ Employee mapping
- Employees, Roles, Permissions
- Role-Permission และ User-Role (single role) mapping
- UI / route / API authorization ที่เกี่ยวข้อง
- Disable user / reset password / session refresh ตามที่ระบบรองรับ

## Phase Rules

- Relational RBAC ใน DB เป็น authoritative สำหรับ runtime
- คง Single Role ต่อ Employee จนกว่าจะได้รับ approval ให้เปลี่ยน
- ห้ามแก้ Phase 15
- ขอ approval เมื่อเปลี่ยน auth architecture, Multiple Roles, หรือ destructive migration

## Tasks

**Phase 16 progress:** Task 16.6 `COMPLETED` — **Phase 16 COMPLETED**

### Task 16.1 — Authentication and RBAC Audit

ตรวจสอบระบบ Authentication, Users, Roles, Permissions และ authorization จากโค้ดจริง
อัปเดต Audit Results ใน `docs/plans/PHASE_16_USER_ROLE_PERMISSION.md`

สถานะ: COMPLETED

### Task 16.2 — Roles CRUD

ทำให้จัดการ Roles ได้จริง (list / create / edit / activate-deactivate)
โดยยังไม่ขยายไป Users หรือ Permission matrix จนกว่า task นี้จะเสร็จ

สถานะ: COMPLETED

### Task 16.3 — Role-Permission Mapping

จัดการการอ่าน permissions และผูก/ถอด permissions กับ role
บนตาราง `permissions` / `role_permissions` ที่มีอยู่

สถานะ: COMPLETED

### Task 16.4 — Employees CRUD

จัดการ Employee profile, ผูก Auth user และ assign role
โดยยังไม่รวม invite/password reset นอก scope

สถานะ: COMPLETED

### Task 16.5 — Employee Soft-Disable

เพิ่มกลไกปิดใช้งานพนักงาน (เช่น `is_active`) และบังคับใน login/middleware
โดยไม่พึ่งการถอด Auth mapping อย่างเดียว

สถานะ: COMPLETED

### Task 16.6 — Phase 16 Integration Verification

ตรวจ regression ของ Auth/RBAC และ Roles/Permissions/Employees ครบวงจร
ก่อนปิด Phase 16

สถานะ: COMPLETED

**Evidence:** `npm run test:ci` PASSED; Auth/RBAC E2E **91 passed**; `rbac-preflight` PASSED

## Reference

แผนละเอียดและ Audit Results: `docs/plans/PHASE_16_USER_ROLE_PERMISSION.md`

---

# Phase 17 — Employee Auth Linking & Permission Localization

## Goal

เชื่อม Employee creation กับ Supabase Auth UUID โดยอัตโนมัติ
และเพิ่มชื่อภาษาไทยกำกับ Permission โดยไม่เปลี่ยน Permission Code

## Scope

- Employee creation + Auth user find/create/link
- Permission localization (Thai labels)
- ไม่เปลี่ยน authorization behavior / Permission Code
- ห้ามย้อนแก้ Phase 16 นอก regression ที่เกิดจาก Phase 17 โดยตรง

## Phase Rules

- ไม่สร้าง Signup flow ซ้อนของเดิม ถ้ามี helper ให้ reuse
- (**Audit 17.1:** ไม่มี Signup ในแอป — Auth provisioning ต้องออกแบบใหม่ด้วย Admin API)
- ขอ approval เมื่อเปลี่ยน auth architecture, destructive migration, หรือรวมข้อมูลซ้ำ

## Tasks

**Phase 17 progress:** Task 17.4 `COMPLETED` — **Phase 17 COMPLETED**

### Task 17.1 — Employee, Signup and Permission Audit

ตรวจสอบ Employee creation, Signup/Auth linking และ Permission Codes จากโค้ดจริง
พร้อมเสนอชื่อภาษาไทยครบทุกสิทธิ์

สถานะ: COMPLETED

### Task 17.2 — Employee and Supabase Auth UUID Linking

ทำให้การสร้าง/แก้ไข Employee เชื่อม `auth.users.id` เข้า `Employee.authUserId`
โดยอัตโนมัติตามแนวทางจาก Audit

สถานะ: COMPLETED

### Task 17.3 — Permission Thai Localization

เติมชื่อภาษาไทยกำกับ Permission ทุกตัวโดยไม่เปลี่ยน Permission Code

สถานะ: COMPLETED

### Task 17.4 — Phase 17 Integration Verification

ตรวจ regression ของ Employee Auth linking และ Permission localization
ก่อนปิด Phase 17

สถานะ: COMPLETED

**Evidence:** `npm run test:ci` PASSED; Auth/RBAC E2E **91 passed**; `rbac-preflight` PASSED

## Reference

แผนละเอียดและ Audit Results: `docs/plans/PHASE_17_EMPLOYEE_AUTH_PERMISSION_LOCALIZATION.md`