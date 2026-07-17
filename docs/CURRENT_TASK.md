# Current Task

## Task

Fix Application error after login for non-ADMIN users

## Status

COMPLETED

## Objective

ป้องกัน client exception หลัง login เมื่อ role/permissions/employee ไม่ครบ — แสดง /access-denied แทน

## Evidence

- `/api/auth/me` normalize permissions + error codes; safe permission map in `findEmployeeAuthorization`
- Provider/sidebar/nav/`canAccess*` null-safe (`permissions = []`)
- ไม่มี role → redirect `/access-denied`; `/set-password` ไม่โหลด Sidebar
- `tsc` + eslint changed files + `npm run build` pass

## Next Action

Deploy แล้วทดสอบ login ด้วยบัญชี RECEPTION/KITCHEN ที่ผูก authUserId + roleId + rolePermissions ครบ

## Deploy

ไม่ต้อง migrate
