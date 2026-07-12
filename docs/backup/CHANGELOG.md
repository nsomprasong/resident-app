# Changelog

รูปแบบอ้างอิง Keep a Changelog ในระดับแนวคิด โดยแยก Added, Changed, Fixed, Security และ Known Limitations.

## [Unreleased]

### Added

- เอกสารควบคุมการพัฒนา `IMPLEMENTATION_PLAN.md`, `PROJECT_STATUS.md` และ append-only `WORK_LOG.md`
- Phase 0 Secret Leakage Audit baseline โดยไม่เปิดเผยค่าความลับ
- Phase 0 verification baseline: ESLint, TypeScript strict noEmit และ Next.js production build ผ่าน
- Phase 0 Baseline Report พร้อม Acceptance Criteria evidence, residual risks และ Phase 1 approval gate
- Phase 1 Authentication Plan สำหรับ Supabase SSR session, Employee identity mapping, access policy และ rollback
- Supabase SSR browser/server client helpers และ public environment placeholders
- Supabase Auth session refresh middleware และ server-side Employee identity lookup helper
- Email/Password Login page และ server-side Login/Logout actions
- Initial Supabase Auth user เชื่อมกับ Employee และตรวจ mapping สำเร็จโดยไม่เปิดเผย UUID
- Authenticated-by-default page/API guards พร้อม 401 JSON contract สำหรับ unauthenticated APIs
- Protected current-employee endpoint และ Sidebar identity UI แทนข้อมูลผู้ใช้ hard-coded
- เปลี่ยน Logout จาก build-specific Server Action เป็น stable POST route และผ่าน user verification
- Phase 1 Verification Report พร้อมระบุ expiry/revocation และ automated Auth test gaps
- Auth Verification Plan สำหรับ Playwright, dedicated test user, local logout scope และ controlled revocation
- Playwright Chromium foundation, isolated `.next-test`, local Logout scope และ unauthenticated Auth E2E 4/4
- แก้ middleware public Logout exception bug ที่ตรวจพบโดย E2E
- Dedicated Auth test user และ authenticated Login/Identity/local Logout E2E; Auth suite รวม 6/6 ผ่าน
- Controlled global revocation E2E; revoked refresh token ถูกปฏิเสธ และ Auth suite รวม 7/7 ผ่าน
- Access-token TTL evidence และ isolated Supabase expiry-test plan โดยไม่เปลี่ยน active project
- Parameterized unauthenticated API guard coverage 17/17; full Auth E2E suite 24/24 ผ่าน
- Parameterized application page guard coverage 12/12; full Auth E2E suite 36/36 ผ่าน
- Phase 1 non-expiry audit พบ Employee mapping enforcement gap นอก Login/current-user endpoint
- Centralized Node.js middleware Employee mapping boundary, access-denied page และ verified unmapped-user denial/session-cleanup E2E; Auth suite ผ่าน 37/37
- Controlled wall-clock Auth expiry E2E: access-token expiry, automatic refresh และ revoked refresh token ผ่าน 2/2 พร้อมยืนยัน rollback TTL เป็นค่าเดิม
- Phase 2 RBAC baseline/approval plan พร้อม proposed role vocabulary, permission groups, migration boundary และ Acceptance Criteria
- อนุมัติ role vocabulary 6 กลุ่มสำหรับ Phase 2 โดย permission matrix ยังรอการยืนยัน
- อนุมัติ permission decisions และเพิ่ม typed default-deny RBAC policy/server helper พร้อม policy tests 2/2
- เปิดใช้ explicit method/path API permission enforcement พร้อม unknown API/role default deny และ API mapping tests
- เพิ่ม safe setup guide/placeholders สำหรับ dedicated RBAC role test users

### Changed

- จัด Roadmap/TODO ตาม Phase dependency และแยกหน้าที่จาก Implementation Plan
- แก้ถ้อยคำ Security/Environment: ยังไม่พบหลักฐานว่า `.env.example` เคย commit; ต้องตรวจ history ก่อน purge

### Security

- Sanitize `.env.example`, สแกน Git history 9 revisions โดยไม่พบ matching secret path, rotate Supabase credential และยืนยันการเชื่อมต่อด้วย Prisma สำเร็จ

## [0.1.0] - 2026-07-10

### Added

- Next.js/Tailwind application shell และ navigation
- การจองรายเดี่ยว/กลุ่ม ห้อง/แพ และ availability ตามช่วงวัน
- ราคาเหมารายหัว, extra room/raft/food และ booking lifecycle
- Food/minibar product, basket และ order creation
- Partial payment, payment channel และ refund หลังยกเลิก
- Housekeeping inspection, central inspection catalog, charge และ close job
- Prisma schema, migrations, Supabase PostgreSQL TLS connection และ seed
- Documentation ชุดภาพรวม 13 ไฟล์
- มาตรฐาน AI/Engineering: `AI/AGENTS.md`, coding/workflow/testing/review/security/performance guides, ADR, business rules, glossary, roadmap และ TODO

### Changed

- สถานะหลังปิดงานแสดง “ปิดงานแล้ว” โดยยังเก็บ BookingStatus เป็น CHECKED_OUT และใช้ `closedAt`
- ห้องกลับ AVAILABLE เมื่อ inspection ของห้องนั้น complete
- รับเงินได้หลายเวลา/หลายงวด; QR ถูกพักและใช้การกรอกยอด

### Security

- เอกสารระบุ credential exposure, การขาด Auth/RBAC/RLS และลำดับ remediation

### Known Limitations

- Dashboard, Kitchen, Employee Schedule, Wage, Report และ Settings ยังไม่ Implement สมบูรณ์
- ยังไม่มี automated tests/CI, Authentication, Authorization, RLS, audit log, rate limiting และ observability
- ยังไม่พร้อม production จนกว่ารายการ Critical ใน `TODO.md` จะถูกแก้
