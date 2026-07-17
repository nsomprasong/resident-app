# Current Task

## Task

Food set: replace individual menus for group-only customization

## Status

COMPLETED

## Evidence

- `BookingFoodSelect`: ปุ่ม「เปลี่ยน」ต่อเมนู → เลือกเมนูใหม่แทน (ไม่แก้ชุดมาตรฐาน)
- `BookingFoodSetPanel`: ข้อความใช้เฉพาะกรุ๊ป + ส่ง `foodSet` meta
- `POST /api/bookings` (group): บันทึก `TourGroupFoodSet` จากรายการที่ปรับแล้ว
- `tsc` + eslint changed files pass

## Next Action

ลองจองกรุ๊ป: เลือกชุด → กดเปลี่ยนทอดมันเป็นต้มยำ → บันทึก แล้วเช็กว่า Settings ชุดเดิมไม่เปลี่ยน
