# Current Task

## Task

Fix service data reset rollback on audit logs

## Status

COMPLETED

## Objective

แก้การล้างข้อมูลบริการที่ไม่สำเร็จเพราะ audit_logs immutable trigger ทำให้ transaction rollback ทั้งก้อน

## Evidence

- Root cause: DELETE audit_logs blocked → whole wipe rolled back
- Migration allows purge when `app.allow_audit_purge=on`
- Service data wiped successfully after fix
- `/today` set to `force-dynamic`

## Next Task

(รอ approval — MASTER_PLAN ยังไม่มี Phase 18)
