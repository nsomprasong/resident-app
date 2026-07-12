# Phase 2 Authorization และ RBAC Plan

สถานะ: `APPROVED` — role vocabulary และ permission decisions ได้รับอนุมัติแล้ว

## Baseline จาก Source Code

- `Employee.role` เป็น `String` และไม่มี enum/check constraint
- พบ role ที่ยืนยันจาก test fixture เพียง `ผู้ดูแลระบบ`
- Middleware บังคับ Authentication และ Employee mapping แต่ไม่ตรวจ permission
- Sidebar/Home แสดงทุกเมนูแก่พนักงานที่ authenticate แล้ว
- Route Handlers ทั้งหมดไม่มี role/permission enforcement
- ไม่มี RLS policy หรือ least-privilege database role ในขอบเขต Phase 2 ปัจจุบัน

## Security Boundary ที่เสนอ

1. ใช้ server-side authorization เป็น authoritative boundary
2. UI ซ่อนเมนู/ปุ่มเพื่อ UX เท่านั้น ห้ามใช้แทน API guard
3. ทุก protected page และ Route Handler ระบุ permission ที่ต้องใช้แบบ explicit
4. Default deny สำหรับ role/permission ที่ไม่รู้จัก
5. ตอบ API `403` ด้วย error contract กลาง; page redirect ไปหน้า forbidden
6. ห้ามเชื่อ role จาก client, request body หรือ local storage

## Role Vocabulary ที่อนุมัติแล้ว

อนุมัติเมื่อ 2026-07-11 และสามารถเพิ่ม role ภายหลังผ่าน policy กลาง:

| Role code | ชื่อแสดงผล | ขอบเขตโดยสรุป |
|---|---|---|
| `ADMIN` | ผู้ดูแลระบบ | ทุก permission และจัดการสิทธิ์ |
| `RECEPTION` | พนักงานต้อนรับ | Booking, room/raft, guest, food order สำหรับลูกค้า |
| `HOUSEKEEPING` | แม่บ้าน | รายการตรวจห้องและบันทึก inspection/charge |
| `KITCHEN` | ครัว | ดูและดำเนินงาน order ของครัว |
| `ACCOUNTING` | บัญชี/แคชเชียร์ | Payment, refund, channel และ financial view |
| `MANAGER` | ผู้จัดการ | Operational/report read และ approval ที่กำหนด |

ยังห้ามเปลี่ยน schema/source จนกว่า permission matrix จะครบและได้รับอนุมัติ implementation

## Permission Groups ที่เสนอ

- `booking.read`, `booking.write`, `booking.lifecycle`
- `resource.read`, `resource.manage`
- `order.read`, `order.write`, `order.kitchen`
- `payment.read`, `payment.collect`, `payment.refund`, `payment_channel.manage`
- `inspection.read`, `inspection.write`, `inspection.complete`
- `catalog.read`, `catalog.manage`
- `employee.read`, `employee.manage`, `wage.read`
- `report.read`, `settings.manage`, `authorization.manage`

## Implementation Tasks

1. Task 2.1 — อนุมัติ role vocabulary และ role-permission matrix
2. Task 2.2 — สร้าง typed authorization policy และ server helper โดยยังไม่แก้ schema
3. Task 2.3 — บังคับ permission ใน API handlers พร้อม 401/403 tests
4. Task 2.4 — บังคับ page access และกรอง navigation พร้อม E2E แยก role
5. Task 2.5 — ตัดสินใจ schema hardening (`enum`/reference table/check constraint) และ migration plan
6. Task 2.6 — RBAC regression/security review และ Phase 2 verification report

## Migration และ RLS

- Task 2.2–2.4 สามารถเริ่มด้วย policy mapping จาก role string เดิมเพื่อลดความเสี่ยง
- การเปลี่ยน `Employee.role`, backfill, constraint หรือ enum เป็น schema migration ต้องขออนุมัติแยก
- RLS/least-privilege เป็น Phase 3 ตาม dependency ปัจจุบัน ไม่รวมโดยอัตโนมัติใน Phase 2

## Acceptance Criteria

- ทุก protected page/API มี permission owner ชัดเจน
- Unknown role ถูก deny แบบ fail-closed
- UI และ server policy สอดคล้องกัน แต่ server เป็น authoritative
- มี tests ครอบคลุม allowed/forbidden สำหรับทุก role ที่อนุมัติ
- Admin test user ไม่ใช่หลักฐานเพียงชุดเดียว; ต้องมี dedicated test users ตาม role
- Lint, TypeScript, build และ Auth/RBAC regression ผ่าน
- Documentation, TODO, CHANGELOG และ WORK_LOG synchronized

## Approved Permission Decisions

1. พนักงานต้อนรับรับชำระเงินได้ แต่ refund ใช้ ACCOUNTING หรือ MANAGER
2. แม่บ้านบันทึกรายการตรวจ/ค่าใช้จ่ายได้; การรับเงินจริงเป็นหน้าที่ RECEPTION, ACCOUNTING หรือ MANAGER
3. ครัวเห็นเฉพาะข้อมูลที่จำเป็นต่อการจัดและส่งอาหาร
4. ผู้จัดการดู แก้ อนุมัติ และ refund ได้
5. สิทธิ์พนักงานจัดการโดย ADMIN เท่านั้น; master data จัดการโดย ADMIN และ MANAGER
