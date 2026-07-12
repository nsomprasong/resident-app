# Glossary

| คำศัพท์ | ความหมายในระบบ |
|---|---|
| Booking/Reservation | รายการจองหลักที่รวมลูกค้า วัน ทรัพยากร ค่าใช้จ่าย ออเดอร์ และเงิน |
| Guest | ลูกค้ารายบุคคล |
| Tour Group | กลุ่มลูกค้าพร้อมผู้ติดต่อ |
| Zone | พื้นที่/อาคารที่จัดกลุ่มห้อง |
| Room Type | ประเภทห้อง ราคา ความจุ และชนิดเตียง |
| Room | ห้องพักจริงและ operational status |
| Raft | แพจริงที่จองได้ตามช่วงวัน |
| Package | ราคาเหมาของกลุ่มจากจำนวนคน × ราคาต่อหัว |
| Extra | รายการที่คิดเพิ่มนอก package |
| Charge | ค่าใช้จ่ายระดับ Booking เช่น ห้อง แพ หรือผลตรวจ |
| Product | อาหาร มินิบาร์ หรือสินค้าอื่น |
| Order | คำสั่งอาหาร/สินค้าใน Booking |
| Payment | เงินที่รับจากลูกค้า (`PAID`) |
| Refund | เงินที่คืนหลังยกเลิก (`REFUNDED`) |
| Payment Channel | ช่องทางรับ/คืนเงินและ PaymentMethod |
| Inspection | งานตรวจห้องหลังเช็กเอาต์ |
| Inspection Catalog | รายการและราคากลางสำหรับการตรวจ |
| Close Job | การกำหนด `closedAt` หลังตรวจครบทุกห้อง |
| Availability | ความว่างจากทั้ง operational status และ booking overlap |
| Snapshot Price | ราคาที่คัดลอกมาเก็บใน transaction item เพื่อไม่เปลี่ยนตาม master ภายหลัง |
| Route Handler | HTTP handler ใน `app/api/**/route.ts` |
| Server Action | mutation function ของ Next.js; ปัจจุบันยังไม่พบการ Implement |
| RLS | Row Level Security ของ PostgreSQL/Supabase; ปัจจุบันยังไม่พบ policy ใน repo |
