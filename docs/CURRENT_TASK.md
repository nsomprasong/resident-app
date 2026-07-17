# Current Task

## Task

Fix account-specific mobile login (only nsomprasong@gmail.com worked on phone)

## Status

COMPLETED

## Objective

หาความต่างบัญชีจริง แก้ต้นเหตุ account-specific กัน client exception และห้าม hard-code อีเมลเป็น ADMIN

## Evidence — ความต่างก่อนแก้

| | nsomprasong (ใช้ได้) | บัญชีอื่น (พังบนมือถือ) |
|--|--|--|
| Employee.email | gmail จริง | null หรือ hotmail แยกจาก Auth |
| Auth email | nsomprasong@gmail.com | `*@employee-auth.local` |
| bb. Auth email | — | **invalid** `bb.@employee-auth.local` |
| providers | email | email+phone |
| Role ใน DB ตอนนี้ | ADMIN คนเดียว | OWNER / MANAGER |
| authUserId match | exact | exact (ไม่ใช่ปัญหา UUID) |
| Employee ซ้ำ | ไม่มี | ไม่มี |

Hard-code ที่พบ: `FALLBACK_SUPPORT_EMAILS = ["nsomprasong@gmail.com"]` ใน `lib/auth/support-account.ts`

## Fixes

- ลบ hard-code อีเมล — ใช้เฉพาะ `SUPPORT_ACCOUNT_EMAILS`
- Auth email: `bb.@…` → `bb@…` (repair แล้วบน production Auth)
- ห้าม username ขึ้นต้น/ลงท้ายด้วยจุดสำหรับบัญชีใหม่
- ClientErrorBoundary + null-safe logger / auth/me / getClaims try/catch
- ไม่มี fallback เป็น ADMIN จากอีเมล

## Verification

- Unit (login-identifier, support-account, auth/menus) pass
- `tsc` pass; production build รันต่อ

## Deploy

Deploy โค้ด + ยืนยัน `.env` มี `SUPPORT_ACCOUNT_EMAILS` (ไม่มี fallback ในโค้ดแล้ว)
