# Known Issues และ Technical Debt

## Critical/High

1. Credential จริงปรากฏใน `.env.example`
2. ไม่มี Authentication และ Authorization ทุก API
3. ไม่มี Supabase RLS/least-privilege policy ใน repository
4. ไม่มี audit identity สำหรับรับเงิน คืนเงิน เปลี่ยนสถานะ และตรวจห้อง
5. ไม่มี automated tests หรือ CI gate

## Functional/Data Risks

6. ไม่มี DB constraint บังคับ Booking ต้องมี Guest XOR TourGroup
7. ไม่มี DB exclusion constraint ป้องกัน room/raft overlap; พึ่ง application transaction
8. ยอดเงินคำนวณซ้ำหลาย endpoint เสี่ยงสูตรไม่ตรงกัน
9. Refund ไม่มี relation ไป original payment และใช้ `paidAt` สำหรับเวลาคืน
10. Payment endpoint นับเฉพาะ PAID; โครงสร้าง ledger ยังไม่รองรับ correction/reversal ซับซ้อน
11. GET housekeeping มี write side effect
12. Room operational status และ booking date availability เป็นสอง source of truth
13. reference ใช้ timestamp + random สั้น ไม่มี database retry เมื่อ collision
14. date/time ผสม UTC date parsing กับ local browser date; ควรมี date policy ชัดเจน

## Maintainability/Code Smell

15. Route Handlers และ Client Components บางไฟล์มีหลายความรับผิดชอบ
16. Validation/manual error mapping กระจายและซ้ำ
17. Interface/props บางส่วน inline และ naming legacy (`RoomIconSlect` สะกดผิด)
18. Redux `bookDetail` มีประโยชน์จำกัดเพราะ detail fetch ซ้ำ
19. UI fallback data อาจทำให้ผู้ใช้เข้าใจว่าเป็นข้อมูลจริง
20. Status style fallback ทำให้สถานะใหม่อาจได้สี checkout โดยไม่ตั้งใจ

## Feature Gaps

- Dashboard, Kitchen, EmployeeSchedule, Wage, Report และ Settings ยังไม่ Implement จริง
- Employee/WorkShift มี schema แต่ไม่มี API/workflow
- ไม่มี admin CRUD สำหรับ Zone, RoomType, Room, Raft, Product, InspectionCatalog
- ไม่มี inventory, tax, receipt, invoice, notification หรือ report export
- ไม่พบ Server Actions, Middleware, observability และ backup/runbook ใน repo
