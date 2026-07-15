# Current Task

## Task

ปรับระบบ Login พนักงานรองรับ Username / Phone โดยไม่กระทบ Email Auth เดิม

## Status

COMPLETED

## Objective

พนักงานใหม่: Username + Phone + Password (Supabase Phone Auth)
พนักงานเดิม: Login ด้วย Email ได้ตามปกติ
ใช้ `mustResetPassword` ที่มีอยู่แล้วแทนการสร้าง field `mustChangePassword` ใหม่

## Evidence

- Migration `20260715100000_employee_username_phone_login` applied (username + unique phone)
- Dual login: email / phone / username → `app/login/actions.ts`
- Create phone Auth + cleanup: `lib/supabase/admin.ts`, `POST /api/employees`
- `/api/auth/me` additive fields; RBAC/middleware เดิมคงไว้
- Readiness: `scripts/check-employee-auth-readiness.ts`
- Verify: prisma validate/generate, tsc, lint, build, `npm run test:unit` ผ่าน

## Next Task

ตาม MASTER_PLAN / คำสั่งผู้ใช้ — ยังไม่ควรลบ email login / register / email reset จนกว่าจะย้ายบัญชีเก่าครบ
