# Current Task

## Task

Settings employee create: assign EMP-xxxx code

## Status

COMPLETED

## Evidence

- Gap was `POST /api/employees` (ตั้งค่าข้อมูลหลัก) — no `employeeCode`
- Login register + HR create already used `nextEmployeeCode()`
- Settings create now assigns `EMP-####` on both username and legacy email paths

## Next Action

—
