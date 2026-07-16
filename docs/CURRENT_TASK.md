# Current Task

## Task

แก้เวลากะแบบมีวันที่มีผล (อดีตไม่เปลี่ยน / ตั้งล่วงหน้าได้)

## Status

COMPLETED

## Objective

- แกเวลาไม่ย้อนแก้เมื่อวาน
- ระบุ effectiveFrom เช่น พรุ่งนี้ ค่าวันนี้ยังใช้ของเดิม
- WorkSchedule ที่ materialize แล้วของวันก่อน effectiveFrom ไม่ถูก overwrite

## Evidence

- `ShiftTemplateTimePeriod` + migration `20260715170000_shift_template_time_periods`
- PATCH รับ `effectiveFrom`; rematerialize เฉพาะ `workDate >= effectiveFrom`
- `ensureWorkScheduleFromMembership` ไม่ sync ทับแถวเดิม
- UI: ฟิลด์ “เวลามีผลตั้งแต่วันที่” (default พรุ่งนี้) + แสดง pending change
- unit test resolve + `tsc` ผ่าน; migrate deploy แล้ว

## Next Task

ตาม MASTER_PLAN / คำสั่งผู้ใช้
