# Business Rules

## Booking/Reservation

- ต้องเป็น `solo` หรือ `group`, มีชื่อ/โทรศัพท์/วัน และมีห้องหรือแพอย่างน้อยหนึ่งรายการ
- Check-in ต้องเป็นวันนี้หรืออนาคต; Check-out ต้องหลัง Check-in
- ช่วงวันชนเมื่อ `existing.checkIn < newCheckOut` และ `existing.checkOut > newCheckIn`
- `CANCELLED` และ `CHECKED_OUT` ไม่บล็อก availability
- Booking รายเดี่ยวสร้าง Guest; กลุ่มสร้าง TourGroup
- State transition: PENDING → CONFIRMED/CANCELLED; CONFIRMED → CHECKED_IN/CANCELLED; CHECKED_IN → CHECKED_OUT

## Pricing/Package

- กลุ่มต้องมี guestCount ≥ 1 และ pricePerPerson ≥ 0; package = จำนวนคน × ราคาต่อหัว
- ห้อง/แพ/อาหารที่เลือกตอนสร้างกลุ่มถือรวมใน package
- ห้อง/แพที่เพิ่มภายหลังและ OrderItem `isExtra=true` คิดเพิ่ม
- รายเดี่ยวคิด room/raft ตามราคาต่อคืนและจำนวนคืน

## Check-in/Check-out/Inspection

- Check-in เปลี่ยนห้องเป็น OCCUPIED
- Check-out เปลี่ยนห้องเป็น CLEANING และสร้าง RoomInspection ที่ขาด
- Inspection เลือกเฉพาะ catalog active; server เป็นผู้กำหนดชื่อ/type/ราคา
- Complete inspection ทำห้องนั้น AVAILABLE และ upsert ค่าใช้จ่าย
- ปิดงานได้เมื่อ booking CHECKED_OUT และทุกห้อง inspection COMPLETED; `closedAt` ใช้แสดง “ปิดงานแล้ว”

## Payment/Refund

- รับเงินได้เมื่อ booking ไม่ CANCELLED, จำนวน >0 และไม่เกิน outstanding
- ครั้งแรกตั้ง reference เป็นเงินมัดจำ; ครั้งต่อไปเป็นลำดับ
- Refund ได้เฉพาะ CANCELLED, ต้องมี channel และไม่เกินยอด PAID ลบ REFUNDED
- Payment/Refund ใช้ Payment table แยกด้วย status

## Food/Order

- Order ต้องผูก booking ที่ไม่ CANCELLED/CHECKED_OUT และมี product active
- รายการซ้ำ product+note ถูก group เป็น quantity
- ราคาถูก snapshot จาก Product; order ภายหลังเป็น extra
- Kitchen status workflow: schema มีสถานะ แต่ UI processing ยังไม่พบการ Implement

## Employee/Promotion/Late Checkout

- Employee/WorkShift มี schema แต่ workflow ยังไม่พบการ Implement
- Promotion และ Late Checkout ยังไม่พบการ Implement
# Authorization และ Role

- Role หลักที่อนุมัติ: ผู้ดูแลระบบ (`ADMIN`), พนักงานต้อนรับ (`RECEPTION`), แม่บ้าน (`HOUSEKEEPING`), ครัว (`KITCHEN`), บัญชี/แคชเชียร์ (`ACCOUNTING`) และผู้จัดการ (`MANAGER`)
- สามารถเพิ่ม role ภายหลังได้ผ่าน authorization policy กลาง
- RECEPTION รับชำระเงินได้แต่ refund ไม่ได้; refund ใช้ ACCOUNTING หรือ MANAGER
- HOUSEKEEPING บันทึกรายการตรวจและค่าใช้จ่ายได้ แต่การรับเงินจริงใช้ RECEPTION, ACCOUNTING หรือ MANAGER
- KITCHEN เห็นเฉพาะข้อมูลที่จำเป็นต่อการจัดและส่งอาหาร
- MANAGER ดู แก้ อนุมัติ refund และจัดการ master data ได้ แต่จัดการสิทธิ์พนักงานไม่ได้
- ADMIN จัดการ master data และสิทธิ์พนักงานได้ทั้งหมด
- Server/API ต้องเป็น authoritative authorization boundary และ unknown role ต้องถูกปฏิเสธแบบ default deny
