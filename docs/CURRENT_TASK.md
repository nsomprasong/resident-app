# Current Task

## Task

Fix self-registered users cannot login after role + activate

## Status

COMPLETED

## Why (difference)

| | ลงทะเบียนหน้า login | เพิ่มในโปรแกรม |
|--|--|--|
| Auth login | `username@employee-auth.local` + รหัสที่ตั้งตอนสมัคร | temp password + `mustResetPassword` |
| รหัสผ่านแรก | ใช้รหัสตอนสมัคร | ตั้งใหม่ผ่านหน้า set-password |
| Employee.email | อีเมลติดต่อ (ถ้ามี) ≠ Auth | มักว่าง |

## Bugs ที่ทำให้เข้าไม่ได้

1. Login ด้วยอีเมลติดต่อ → ใช้เป็น Auth email ตรงๆ (ผิด)
2. Settings แก้/เซฟอีเมลของบัญชีที่มี username → `resolveAuthUserIdForEmail` สลับ `authUserId` ทิ้ง mailbox เดิม

## Fix

- Login: resolve อีเมลติดต่อ → username Auth mailbox
- Settings: บัญชีมี username ไม่วิ่ง rebind Auth จากอีเมลติดต่อ
- `ensureAuthLoginEmail` + repair `authUserId` หลัง sign-in ถ้าชี้ผิดตัว
