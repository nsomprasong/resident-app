# Current Task

## Task

Fix Application error after login for non-ADMIN users

## Status

COMPLETED

## Objective

ป้องกัน client exception หลัง login เมื่อ role ไม่อยู่ใน matrix / permissions ว่าง / employee ไม่ครบ — แสดง /access-denied แทน และไม่ fallback เป็น ADMIN

## Evidence

- Root cause: DB มี role `OWNER`/`SUPERMARKET` นอก hardcoded matrix → `hasPermission` throw `.has` on undefined
- Active auth users: ADMIN×1, OWNER×2, MANAGER×1 — non-admin ที่เจอบ่อยคือ OWNER
- เพิ่ม OWNER/SUPERMARKET ใน matrix; harden `hasPermission`; denial codes + Thai `/access-denied?reason=`
- Tests: `auth-access-denial` 5/5, `rbac-policy` 5/5; `tsc` pass; `npm run build` pass

## Next Action

Deploy แล้วทดสอบ login ADMIN + OWNER + MANAGER บน production

## Deploy

ไม่ต้อง migrate
