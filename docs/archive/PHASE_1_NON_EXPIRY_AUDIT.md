# Phase 1 Non-expiry Readiness Audit

วันที่ตรวจ: 2026-07-11

## ผลสรุป

ยังไม่พร้อมกลับไป Task 1.14 เพราะพบ Employee mapping enforcement gap ที่ไม่ขึ้นกับ wall-clock expiry

## Confirmed Evidence

- Supabase session claims ถูก verify/refresh ใน middleware
- Unauthenticated API handlers 17/17 คืน 401 JSON
- Unauthenticated application pages 12/12 redirect ไป Login
- Login ตรวจ Employee mapping ก่อน redirect
- Current-user endpoint ตรวจ Employee mapping และคืน 403 เมื่อไม่พบ
- Login/Identity/Logout/Revocation tests ผ่าน

## Critical Gap

Middleware ตรวจเฉพาะ Supabase claims และไม่ได้ตรวจ Employee mapping

Business API handlers ไม่เรียก current-user/Employee enforcement helper และพึ่ง middleware เพียงอย่างเดียว

ผลคือ Auth user ที่ได้ session จากช่องทางอื่นนอก Login action เช่น direct Supabase Auth API อาจ:

- ผ่าน page middleware
- เรียก business APIs ได้
- ได้รับสิทธิ์ระดับ authenticated แม้ไม่มี Employee mapping

Login action ที่ปฏิเสธ unmapped user ไม่ใช่ security boundary ที่เพียงพอ เพราะสามารถข้าม UI Login ได้

## Documentation Discrepancy

Authentication plan ระบุว่า unmapped user ต้องถูกปฏิเสธ แต่ Source Code บังคับเฉพาะ Login action และ current-user endpoint

## Required Remediation

1. สร้าง server-side requireEmployee helper ที่ยืนยัน Auth user และ Employee mapping
2. บังคับ business APIs ทุก handler ผ่าน helper หรือ centralized server boundary
3. ป้องกัน application pages ด้วย Employee-aware boundary โดยไม่ query database ใน Edge-incompatible middleware หาก runtime ไม่เหมาะสม
4. เพิ่ม dedicated unmapped Auth user E2E tests สำหรับ page/API 403/redirect
5. รัน API/page coverage, full Auth suite, lint, typecheck และ build

## Status Decision

- Task 1.17 Audit: COMPLETED
- Phase 1: IN_PROGRESS
- Task 1.18 Employee Mapping Enforcement: REQUIRED
- Task 1.14: ยัง DEFERRED และยังเป็น final gate หลัง Task 1.18 ผ่าน
