# Phase 1 Authentication Plan

สถานะ: In Progress — Task 1.7 Identity UI/Logout ผ่าน user verification แล้ว

## Current Evidence

- ไม่มี Supabase Auth client, session middleware หรือ protected route
- API routes ไม่มี authenticated identity boundary
- Sidebar แสดงผู้ใช้ hard-coded
- `Employee.authUserId` เป็น nullable UUID และ unique อยู่แล้ว
- ยังไม่มี automated test framework

## Proposed Architecture

1. ใช้ Supabase Auth สำหรับ identity และ password/session lifecycle
2. ใช้ `@supabase/ssr` และ `@supabase/supabase-js` สำหรับ Next.js App Router
3. Browser client ใช้เฉพาะ publishable/anon key; ห้ามส่ง database/service-role credential เข้า client
4. Server client อ่าน/เขียน session ผ่าน secure cookies
5. Server trust boundary ต้องยืนยันผู้ใช้กับ Supabase Auth; ห้ามเชื่อ metadata หรือ cookie payload โดยไม่ verify
6. เชื่อม authenticated user กับ `Employee.authUserId`; ผู้ใช้ที่ไม่มี Employee mapping ถูกปฏิเสธ
7. เพิ่มหน้า Login/Logout และ protected application shell
8. API mutations และข้อมูลธุรกิจต้องตรวจ session ฝั่ง server; RBAC ราย role เป็น Phase 2

## Proposed Access Policy

- Public: หน้า login และ auth callback เท่านั้น
- Authenticated: application pages และ business APIs ทั้งหมด
- Unmapped employee: ต้องปฏิเสธการใช้งานพร้อม error ที่ไม่เปิดเผยข้อมูล; audit 2026-07-11 พบว่ายัง enforce เฉพาะ Login และ `/api/auth/me` ไม่ครบ business boundaries
- Default deny เมื่อ session validation ล้มเหลว

## Environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` หรือ anon key ตามค่าที่ Dashboard ให้
- ห้ามเพิ่ม service-role key จนกว่าจะมี use case และ security review

## Implementation Tasks

1. [x] ติดตั้ง Supabase client/SSR dependencies และเพิ่ม placeholders ใน `.env.example`
2. [x] สร้าง browser/server Supabase client helpers
3. [x] สร้าง session refresh boundary และ server auth helper
4. [x] สร้าง Email/Password Login/Logout (auth callback ยังไม่จำเป็นสำหรับ password flow ปัจจุบัน)
5. [x] ป้องกัน pages และ APIs แบบ default deny
6. [x] แทน hard-coded user UI ด้วย Employee/session data
7. เพิ่ม automated verification สำหรับ login/logout/protected route เมื่อ test foundation พร้อม

## Schema Impact

ยังไม่เสนอ Prisma migration ในขั้นแรก เพราะ `Employee.authUserId` รองรับ identity mapping อยู่แล้ว ต้องตรวจข้อมูล Employee จริงก่อนพิจารณาเปลี่ยน nullable/constraints ในงานถัดไป

## Rollout

- ทำแบบ additive และแยก auth helpers ออกจาก business handlers
- เปิด protection หลัง login/callback และ Employee mapping พร้อม
- บันทึกรายชื่อ endpoint ที่ย้ายและตรวจ 401 behavior ทีละกลุ่ม

## Rollback

- ย้อน middleware/proxy และ route guards โดยไม่ลบ Employee data
- ถอน login UI/client helpers ได้โดยไม่เปลี่ยน business schema
- หากมี migration ภายหลัง ต้องมี rollback แยกและขออนุมัติก่อน deploy

## Acceptance Criteria

- ผู้ไม่ authenticate เข้า protected page/API ไม่ได้
- Login, logout, expiry และ revocation ทำงาน
- Server ยืนยัน identity และ mapping กับ Employee
- ไม่มี secret ใน client bundle
- Lint, TypeScript และ build ผ่าน
- มี verification evidence สำหรับ protected routes

## Approval Required

- อนุมัติติดตั้ง `@supabase/ssr` และ `@supabase/supabase-js` แล้ว
- อนุมัติให้ทุก application page/business API ต้อง login แล้ว
- ยืนยันว่าจะใช้ Email/Password เป็นวิธี Login แรกแล้ว
- การเปลี่ยน schema หรือ RLS ต้องขออนุมัติแยกเมื่อมีข้อเสนอและ migration plan
