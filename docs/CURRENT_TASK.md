# Current Task

## Task

แสดงวันที่ทั้งโปรเจกต์เป็น format วว/ดด/ปปปป

## Status

COMPLETED

## Objective

วันที่ใน UI ใช้ `DD/MM/YYYY` แบบไทย (พ.ศ.) ผ่าน helper กลาง + DateSelector สำหรับช่องเลือกวันที่

## Evidence

- `lib/format/date.ts` — format วว/ดด/ปปปป
- เมนูเวลาและค่าจ้าง: เปลี่ยน `input type=date` → `DateSelector` ใน Attendance / Leave / OT / สรุปค่าแรง
- API ยังใช้ `YYYY-MM-DD`

## Next Task

ตาม MASTER_PLAN / คำสั่งผู้ใช้
