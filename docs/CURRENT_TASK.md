# Current Task

## Task

Show room inspector name after checkout inspection

## Status

COMPLETED

## Objective

หลังเช็กเอาต์และตรวจห้องเสร็จ ให้แสดงชื่อผู้ตรวจ

## Evidence

- เพิ่ม `completed_by_id` บน `room_inspections` + migration deploy
- บันทึกผู้ตรวจตอน complete จาก employee ของ session
- แสดงใน Booking Detail และหน้าแม่บ้าน

## Next Task

ตาม MASTER_PLAN / คำสั่งผู้ใช้
