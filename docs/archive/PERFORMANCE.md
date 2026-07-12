# Performance Review

## Rendering/Bundle

- Root `MainLayout` เป็น Client Component และครอบทั้งแอป ทำให้ Redux/layout JS อยู่ทุกหน้า
- หน้าธุรกรรมเกือบทั้งหมด client-render หลัง fetch; ไม่มี streaming/Suspense/server prefetch
- Lucide import แบบ named โดยทั่วไป tree-shake ได้
- Fonts ถูก self-host แต่ประกาศหลาย weight; ไม่มี `next/font` optimization

## Data Fetching/Caching

- หลาย fetch ใช้ `no-store`; ข้อมูล master เช่น Product, InspectionCatalog, PaymentChannel ไม่มี caching
- ไม่มี React Query/SWR deduplication
- fallback room/menu data อาจปิดบัง API failure แทนแสดงสถานะผิดพลาด

## Database Query

- มี indexes สำหรับ booking date/status, room zone/status, product type/active, payment booking/status
- Prisma include แบบ nested ใน booking detail และ housekeeping อาจโหลดข้อมูลมากเมื่อประวัติยาว
- GET history ไม่มี pagination
- Housekeeping คำนวณยอดของ booking ซ้ำต่อ inspection และโหลด charges/orders/payments ต่อ booking ที่ซ้ำกันในผลลัพธ์
- ไม่พบ classic query-per-row N+1 จาก Prisma loop ใน request หลัก แต่มี computation/duplicate graph สูง
- Seed ทำ sequential upsert loops; ยอมรับได้สำหรับ dataset เล็ก

## Large Components

Booking forms, booking detail, PayButton และ housekeeping page รวม state/fetch/render จำนวนมาก ทำให้ rerender และ maintenance สูง.

## แนวทาง

- Server-render initial data หรือใช้ server component boundary
- cache/revalidate master data และ invalidate เมื่อแก้
- pagination history/orders และ select เฉพาะ field
- รวม financial calculation เป็น service/query กลาง
- แยก component และ memoize selector ที่เหมาะสม
- เพิ่ม performance budget, bundle analyzer และ query telemetry
