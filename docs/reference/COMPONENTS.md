# Reusable Components

## Layout

- `MainLayout({children})`: Redux Provider, mobile Header, responsive Sidebar
- `Header({onMenuClick})`: mobile app bar
- `Sidebar({open,onClose})`: navigation และ hard-coded user profile

## Booking/Resource

- `AddSoloBookingDialog({open,setOpen,onCreated})`: ฟอร์มรายเดี่ยวและเรียก POST bookings
- `AddGroupBookingDialog(...)`: ฟอร์มกลุ่ม ราคาเหมา และ included food
- `AddBookingResourcesDialog({bookingId,dates,...})`: เพิ่ม room/raft เป็น extra
- `ZoneRoomSelect({selectedRoomIds,onChange,checkIn,checkOut})`: โหลด availability แยก zone
- `RoomIconSelect({roomNo,booked,selected,onToggle,roomType,bedType})`: tile ห้อง/ประเภทเตียง
- `RaftSelect({selectedRaftIds,onChange,checkIn,checkOut})`: โหลด/เลือกแพ
- `BookingFoodSelect({items,onChange,included})`: เลือก product และจำนวน
- `RoomItem`, `RoomGroupItem`: card รายเดี่ยว/กลุ่มและนำทางรายละเอียด
- `DateSelector({date,setDate})`: date input wrapper
- `Status({status})`: status pill; fallback style เป็น checkout

## Food

- `CardMenu`: product card เปิด AddMenuDialog
- `AddMenuDialog`: จำนวน/หมายเหตุและเพิ่ม Redux basket ด้วย UUID
- `Basket({id})`: สรุปตะกร้าและนำทาง checkout
- `OrderItem`, `OrderGroupItem`: card เลือกลูกค้า/booking

## Billing/Common

- `PayButton({amount,onConfirm,mode})`: modal รับ/คืนเงิน โหลด/เพิ่ม payment channel
- `BillItem({icon,title,items,isEdit})`: collapsible bill section
- `BillDetail({title,price,isEdit,summarize})`: bill row
- `Modal({open,onClose,title,children})`: accessible dialog shell ระดับพื้นฐาน
- `BackButton`, `ListMenu`, `UserNav`: navigation/common display

## Dependency และข้อสังเกต

Components ใช้ React state, `fetch`, Tailwind และ Lucide. Food basket ใช้ Redux hooks. หลาย component รวม data fetching, validation และ presentation ในไฟล์เดียว; ไม่มี React Hook Form, schema validation หรือ component test. Props จำนวนมากเขียน inline ทำให้ reuse/documentation ยากขึ้น.
