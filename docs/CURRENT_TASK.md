# Current Task

## Task

Audit log viewer page + permission

## Status

COMPLETED

## Objective

เพิ่มหน้าดูบันทึกตรวจสอบระบบ และสิทธิ์ `audit.read` (ADMIN โดยค่าเริ่มต้น)

## Evidence

- Permission `audit.read` + migration `20260714223000_add_audit_read_permission`
- Page `/system/audit-logs`, API `GET /api/system/audit-logs`, Sidebar/home card
- Labels/menu groups/RBAC page+API rules updated
- Unit: permission labels/menu groups + audit-log-query filters

## Next Task

ตาม MASTER_PLAN / คำสั่งผู้ใช้
