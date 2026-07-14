# Current Task

## Task

Phase 21 — Employee & Attendance Simplification

## Status

COMPLETED

## Objective

ปรับระบบบริหารพนักงานให้เหลืองานที่ใช้จริง: พนักงาน+Auth, กะ, ค่าแรง/OT, ลงเวลามือถือพร้อม geofence, ลาขั้นต่ำ และสรุปค่าแรงรอบจ่าย โดยยุบเมนูผู้ดูแลเหลือ 4 รายการและเพิ่ม “งานของฉัน”

## Evidence

- Schema/migration `20260714210000_phase21_attendance_simplification` (AttendanceEvent, HrAttendanceSetting, shift grace, pay day, default shift, self permissions)
- HR create employee ผูก Supabase Auth (`resolveAuthUserIdForEmail`)
- Self APIs: `/api/hr/my-work`, clock, leave; settings geofence; time-pay summary
- UI: `/my-work`, `/hr/time-pay` (tabs), nav 4+1, HrEmployeesManager ฟอร์ม Auth/Role/ค่าจ้าง/กะ
- Unit: `hr-geo`, `hr-daily-status`, `hr-nav` + related HR tests ผ่าน; `tsc --noEmit` ผ่าน; lint ไม่มี error
- Build: `UNVERIFIED` (next build ค้างหลังโหลด `.env` ในสภาพแวดล้อมนี้)

## Next Task

ตาม MASTER_PLAN / คำสั่งผู้ใช้
