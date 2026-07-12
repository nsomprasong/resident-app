# TODO

## Critical

- [x] Rotate database credential, sanitize `.env.example`, ตรวจ Git history 9 revisions และยืนยันการเชื่อมต่อด้วย Prisma (ไม่พบหลักฐานที่ต้อง purge)
- [x] ปิด Phase 0 พร้อม Baseline Report และ Acceptance Criteria evidence
- [ ] Phase 2: อนุมัติ role vocabulary/permission matrix แล้วเพิ่ม Authorization/RBAC ทุก protected page/API
- [x] Phase 2 Task 2.2: typed default-deny role/permission policy และ server authorization helper
- [x] Phase 2 Task 2.3a: อนุมัติ E2E fixture strategy, standard role codes และเก็บ legacy `ผู้ดูแลระบบ` alias ถึง Task 2.5
- [ ] Phase 2 Task 2.3b: รอผู้ใช้ provision dedicated Auth/Employee E2E fixtures 5 roles
- [ ] Phase 2 Task 2.3c: รัน cross-role allowed/forbidden/unknown-role HTTP E2E; ก่อนผ่านให้ Task 2.3 เป็น NOT VERIFIED
- [ ] Phase 2 Task 2.3d: ตัดสินใจ fixture cleanup/retention หลัง verification
- [ ] Hard stop: ห้ามขยาย API permission enforcement ก่อน Task 2.3c ผ่าน
- [x] เพิ่ม Supabase SSR browser/server client foundation และ environment placeholders
- [x] ตั้งค่า Supabase Project URL/Publishable Key และเพิ่ม verified session refresh boundary
- [x] เพิ่ม Email/Password Login/Logout
- [x] Provision Auth user/Employee mapping แรก
- [x] เพิ่ม protected page/API guards แบบ authenticated-by-default
- [x] แทน hard-coded user UI ด้วย protected Employee identity endpoint
- [x] ยืนยัน authenticated identity UI และ Logout lifecycle
- [x] ยืนยัน session expiry/revocation และเพิ่ม automated Auth tests
- [x] เพิ่ม Playwright/Chromium foundation และ unauthenticated Auth E2E 4 tests
- [x] เพิ่ม dedicated test user และ authenticated Login/Identity/Logout E2E tests
- [x] เพิ่ม controlled refresh-session revocation verification
- [x] [FINAL PHASE 1 GATE] เพิ่ม wall-clock access-token expiry/refresh/revocation verification และตรวจ rollback สำเร็จ
- [x] เพิ่ม Auth guard coverage tests สำหรับ protected API handlers 17/17
- [x] เพิ่ม application page guard coverage 12/12
- [x] ทำ Phase 1 non-expiry readiness audit
- [x] ปิด Task 1.18: centralized Employee mapping boundary และ unmapped-user denial E2E ผ่าน
- [x] วัด active-project TTL และจัดทำ isolated expiry-test decision plan
- [x] เพิ่ม isolated expiry project setup guide และ safe environment placeholders
- [x] เพิ่ม dedicated Auth test user setup guide และ safe environment placeholders
- [x] จัดทำ Phase 1 Verification Report โดยไม่ข้าม Acceptance Criteria ที่ยังขาด
- [ ] กำหนด least-privilege database role และ Supabase RLS strategy
- [ ] เพิ่ม audit identity/log สำหรับ payment, refund, lifecycle, inspection และ master data

## High

- [ ] เพิ่ม runtime schema validation และ error contract กลาง
- [x] บันทึก Phase 0 baseline lint/build/type validation
- [ ] เสนอ test/typecheck scripts ก่อนเพิ่ม dependency
- [ ] รวมสูตร grand/paid/refundable/package ใน domain service เดียว
- [ ] เพิ่ม unit/integration/E2E tests และ CI
- [ ] ออกแบบ immutable payment/refund ledger และ idempotency
- [ ] เพิ่ม DB constraints/invariants และ concurrency protection ของ availability
- [ ] ลบ write side effect ออกจาก GET housekeeping

## Medium

- [ ] Pagination/search สำหรับ history/orders
- [ ] แยก Client Components/Route Handlers ขนาดใหญ่
- [ ] ทำ Settings master-data CRUD พร้อม permission
- [ ] ทำ Kitchen, Employee Schedule, Wage, Dashboard และ Report
- [ ] เพิ่ม observability, backup/restore และ deployment runbook
- [ ] แทน fallback mock data ด้วย explicit error state

## Low

- [ ] ตรวจและถอด dependency QR ที่ไม่ใช้
- [ ] แก้ naming typo `RoomIconSlect` ด้วยแผน rename
- [ ] ใช้ `next/font` หรือวัดประสิทธิภาพ local fonts
- [ ] ปรับ status style ให้รองรับทุกสถานะอย่าง explicit
- [ ] ประเมินว่า Redux `bookDetail` ยังจำเป็นหรือไม่

รายการนี้อ้างอิง `KNOWN_ISSUES.md`, `SECURITY.md`, `PERFORMANCE.md` และ `SUMMARY.md`; เมื่อทำเสร็จให้ย้ายผลไป `CHANGELOG.md` ไม่ลบประวัติโดยไม่มีเหตุผล.
