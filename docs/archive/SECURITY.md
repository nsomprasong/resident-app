# Security Review

## สรุประดับความเสี่ยง

ระดับปัจจุบัน: **สูง** สำหรับการใช้งาน production แม้ Authentication verified และ API RBAC เริ่ม enforce แล้ว แต่ page RBAC, cross-role verification, RLS และ Audit Log ยังไม่ครบ. Credential exposure ใน `.env.example` ได้รับการ contain แล้วเมื่อ 2026-07-11.

## Authentication/Authorization

มี Supabase SSR clients, verified session refresh middleware, Email/Password Login/Logout, Employee mapping และ authenticated-by-default page/API guards แล้ว. Sidebar โหลด name/role จาก protected `/api/auth/me`; API RBAC เริ่ม enforce ใน Phase 2 แต่ page/navigation และ cross-role verification ยังไม่ครบ

Employee mapping ถูกบังคับจาก Node.js middleware สำหรับทุก protected business page/API แบบ fail-closed แล้ว: unmapped user ได้ 403 สำหรับ API หรือหน้า access denied; mapping lookup failure ได้ 503. Dedicated unmapped-user denial/session-cleanup E2E ผ่านแล้ว

API RBAC enforcement ใช้ explicit method/path permission mapping และ unknown API/role ถูกปฏิเสธแบบ default deny แล้ว แต่ cross-role E2E ยังรอ dedicated non-admin test users; page/navigation RBAC เป็น Task 2.4

Logout ปกติใช้ Supabase scope `local` เพื่อยุติเฉพาะ session ปัจจุบัน. Global revocation ต้องเป็น explicit administrative action แยก

## Secret Management

- `.env` ถูก ignore ถูกต้อง
- `.env.example` ใช้ placeholders แล้ว; เจ้าของ rotate credential และ Prisma เชื่อมต่อด้วยค่าชุดใหม่สำเร็จ
- สแกน Git history 9 revisions และ tracked files แล้วไม่พบ matching secret path จึงไม่มีหลักฐานว่าต้อง purge history
- CA certificate ไม่ใช่ private key แต่ควรตรวจ provenance/update lifecycle
- `NEXT_PUBLIC_*` ต้องไม่เก็บ secret เพราะถูกส่งเข้า client bundle

## Input/Injection/XSS

- Prisma parameterization ลดความเสี่ยง SQL injection
- React escaping ลด reflected XSS โดยพื้นฐาน และไม่พบ `dangerouslySetInnerHTML`
- Validation เป็น manual/cast; ไม่มี limit ความยาว, format phone, UUID schema, payload size หรือ decimal precision guard ครบถ้วน
- ข้อความผู้ใช้ถูกเก็บและ render เป็น text จึงยังถูก escape

## CSRF/Session/Rate Limit

ยังไม่พบการ Implement. Mutation ใช้ cookie auth ไม่ได้เพราะยังไม่มี auth; เมื่อเพิ่ม auth ต้องมี SameSite/CSRF strategy. ไม่มี rate limiting หรือ anti-automation.

## Supabase/RLS

ไม่พบ SQL policy หรือ RLS configuration ใน migrations. Server เชื่อม DB โดยตรงผ่าน database credential; security boundary จึงอยู่ที่ Next.js API ซึ่งปัจจุบันไม่มี auth.

## Business Security

- Payment/refund ตรวจยอดใน transaction ช่วยลด overpayment/over-refund แบบ concurrent
- PaymentChannel POST เปิดให้ทุกคนแก้ master data
- ไม่มี immutable ledger, approval, cashier identity หรือ audit trail
- Refund บันทึกเป็น Payment status REFUNDED แต่ไม่อ้าง original payment

## ลำดับแก้ไข

1. ปิด cross-role API verification และเพิ่ม page/navigation RBAC
2. กำหนด RLS/least-privilege database role
3. เพิ่ม runtime schema validation และ request limits
4. เพิ่ม audit log/ผู้ดำเนินการสำหรับเงินและ lifecycle
5. กำหนด RLS/least-privilege DB role
6. เพิ่ม security headers, rate limit, CSRF strategy และ automated security tests
