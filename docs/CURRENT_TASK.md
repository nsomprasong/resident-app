# Current Task

## Task

Fix Application error after login for non-ADMIN users on mobile

## Status

COMPLETED

## Objective

กัน client exception บนมือถือหลัง login สำหรับ non-admin — ไม่ขอ GPS/กล้องตอนโหลดหน้า, มี fallback browser APIs, เมนูว่าง → /access-denied, และมี client error logging ชั่วคราว

## Evidence

- Login redirect ทุก role → `/` (ไม่แยก ADMIN/non-admin)
- ไม่มี localStorage/sessionStorage ในแอป
- GPS เคยเสี่ยงบน `/my-work` (เมนูแรกของ MANAGER) — ย้าย leave-types fetch ไปตอนกดปุ่มลา; GPS ใช้ safe wrapper เฉพาะตอนลงเวลา
- ClientErrorLogger → POST `/api/system/client-error` (message, stack, route, role, userAgent)
- Unit + rbac-policy + mobile menu policy pass; `tsc` + `npm run build` pass

## Next Action

Deploy แล้ว login OWNER/MANAGER บนมือถือ — ดู server log `[client-error-report]` หากยังพัง

## Deploy

ไม่ต้อง migrate
