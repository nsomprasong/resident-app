# โมดูลระบบ

| Module | หน้าที่และไฟล์ | Database | สถานะ/สิ่งที่ควรปรับปรุง |
|---|---|---|---|
| Home/Layout | `app/page.tsx`, `app/layout.tsx`, `components/layout/*` | ไม่มี | ใช้งานได้; user card เป็นข้อมูล hard-coded |
| Booking | `app/booking/*`, dialogs, booking APIs | Booking, Guest, TourGroup, BookingRoom/Raft, Charge | core flow ใช้งานได้; component/handler ใหญ่ |
| Room/Room Type/Zone | room API, `ZoneRoomSelect`, `RoomIconSelect` | Room, RoomType, Zone | read-only UI; admin CRUD ยังไม่พบ |
| Raft | raft API, `RaftSelect` | Raft, BookingRaft | เลือกและคิดราคาได้; admin CRUD ยังไม่พบ |
| Guest/Group | สร้างจาก booking form | Guest, TourGroup | ไม่มีหน้า master/dedup/search โดยตรง |
| Payment/Refund | `PayButton`, payment/refund/channel APIs | Payment, PaymentChannel | partial payment/refund ได้; ไม่มี reconciliation/audit/receipt |
| Food/Minibar | `app/foodOrder/*`, basket components, products/orders API | Product, Order, OrderItem | สร้าง order ได้; kitchen processing ยังไม่ Implement |
| Housekeeping | `app/houseKeeperMinibar`, inspection APIs | RoomInspection, InspectionItem/Catalog, Charge | ตรวจ/คิดเพิ่ม/คืนห้อง/ปิดงานได้; ไม่มี identity ผู้ตรวจ |
| Dashboard | `app/dashboard/page.tsx` | อาจใช้ธุรกรรมทั้งหมด | ยังไม่พบการ Implement นอกจาก placeholder |
| Kitchen | `app/kitchen/page.tsx` | Order/OrderItem | ยังไม่พบการ Implement นอกจาก placeholder |
| Employee Schedule | `app/employeeSchedule/page.tsx` | Employee/WorkShift | ยังไม่พบการ Implement นอกจาก placeholder |
| Wage | `app/wage/page.tsx` | Employee/WorkShift | ยังไม่พบการ Implement นอกจาก placeholder |
| Report | `app/report/page.tsx` | ทุก transaction | ยังไม่พบการ Implement นอกจาก placeholder |
| Settings | กล่าวถึงใน requirement แต่ไม่มี Route | master tables | ยังไม่พบการ Implement |

## State Management

Redux มี `basketList` สำหรับรายการสั่งอาหาร และ `bookDetail` สำหรับ snapshot ก่อนนำทาง. ข้อมูล authoritative ของ booking ถูกโหลดใหม่จาก API ในหน้ารายละเอียด; Redux จึงเป็น convenience state ไม่ใช่ server cache.
