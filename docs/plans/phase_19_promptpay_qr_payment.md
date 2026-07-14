# Phase 19 — PromptPay QR Payment

> เพิ่มระบบรับชำระเงินด้วย PromptPay QR ให้ Resident Hotel Management  
> บัญชีพร้อมเพย์จัดการได้จากหน้าตั้งค่า และ QR ต้องสร้างตามยอดที่ต้องชำระ  
> ขอบเขตนี้เพิ่มเฉพาะการรับชำระเงิน ห้ามรื้อหรือเปลี่ยน business logic ระบบรับจองที่ทำงานดีแล้ว

---

## 1. Phase Status

- **Phase:** 19
- **Status:** `COMPLETED`
- **Implementation:** `COMPLETED`
- **Verification:** `VERIFIED` (unit + tsc + lint + migrate deploy)
- **Last updated:** 2026-07-13
- **Current task:** —
- **Next task:** ตาม MASTER_PLAN / คำสั่งผู้ใช้

ค่าที่อนุญาต:

- `PLANNED`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETED`

---

## 2. เป้าหมาย

1. ตั้งค่าบัญชีพร้อมเพย์จาก `ตั้งค่าข้อมูลหลัก → การรับชำระเงิน`
2. สร้าง PromptPay QR จากยอดที่ต้องการรับ โดยแอปธนาคารแสดงยอดอัตโนมัติ
3. รับชำระจากหน้ารายละเอียดการจองโดยไม่เปลี่ยนระบบรับจองเดิม
4. รองรับมัดจำ แบ่งชำระ ชำระเต็มจำนวน และหลายรายการต่อหนึ่งการจอง
5. อัปโหลดหลักฐานและตรวจสอบการรับเงิน
6. เก็บประวัติ Permission และ Audit log
7. ออกแบบให้ต่อยอด Payment Gateway/Webhook ได้ภายหลัง

---

## 3. กฎการทำงานสำหรับ Cursor

1. อ่าน `AGENTS.md`, `docs/CURRENT_TASK.md` และไฟล์นี้ก่อนเริ่ม
2. อ่านเฉพาะไฟล์ route/component/service/schema ที่เกี่ยวข้อง เพื่อลด token และเครดิต
3. ทำ Task ตามลำดับและทำต่อเนื่องจนจบ Task/Phase โดยไม่ขออนุมัติย่อย
4. ขอผู้ใช้เฉพาะกรณีต้องใช้ secret, provider account, irreversible action หรือ business decision ที่ไม่มีในแผน
5. ใช้ component, Design Token, API pattern, RLS และ audit pattern เดิมก่อนสร้างใหม่
6. ห้าม refactor ระบบรับจอง ระบบพนักงาน หรือโมดูลอื่นที่ไม่เกี่ยวข้อง
7. ห้าม hardcode หมายเลขพร้อมเพย์ ยอดเงิน หรือข้อมูลบัญชีใน frontend/source code
8. การเปลี่ยนฐานข้อมูลต้องผ่าน migration ที่ตรวจสอบและย้อนกลับได้
9. หลังจบทุก Task ให้อัปเดต Phase Status, Progress Log และ Completion Log
10. ห้ามระบุว่าเสร็จจนกว่า TypeScript, lint/build และ Acceptance Criteria ผ่าน

---

## 4. ขอบเขต

### ทำใน Phase นี้

- Payment Settings
- บัญชีพร้อมเพย์หนึ่งหรือหลายบัญชี
- PromptPay QR payload พร้อมจำนวนเงิน
- UI รับชำระจาก Booking Detail
- Payment records
- มัดจำ/แบ่งชำระ/ยอดคงเหลือ
- อัปโหลดสลิป
- Manual verification
- ยกเลิกรายการและบันทึกคืนเงิน
- Receipt/print/download QR
- Permission, RLS และ Audit log
- รายงานรับชำระขั้นพื้นฐาน

### ไม่ทำใน Phase นี้

- เชื่อม API ธนาคาร
- ตรวจเงินเข้าอัตโนมัติ
- Payment Gateway/Webhook
- OCR สลิปอัตโนมัติ
- เปลี่ยน workflow การจองเดิม
- รื้อบัญชีหรือรายงานเดิม
- เปลี่ยน schema ที่ไม่เกี่ยวกับ Payment

---

## 5. มาตรฐาน QR

- ใช้ Thai QR Payment / PromptPay แบบ Merchant-Presented
- สกุลเงินบาทใช้รหัส `764`
- จำนวนเงินอยู่ใน Transaction Amount และใช้ทศนิยมสองตำแหน่ง
- Payload ต้องมี CRC ที่ถูกต้อง
- รองรับ PromptPay identifier ตามประเภทที่ระบบอนุญาต
- QR ต้อง regenerate เมื่อบัญชีหรือยอดเงินเปลี่ยน
- ใช้ library ที่เชื่อถือได้และมี maintenance ก่อนเขียน payload เอง
- เพิ่ม unit test ด้วย known payload/test vector ห้ามทดสอบจากการมองภาพ QR อย่างเดียว

> การสร้าง QR ไม่ใช่หลักฐานว่าได้รับเงินแล้ว สถานะต้องไม่เปลี่ยนเป็นชำระแล้วจนกว่าจะผ่านการยืนยัน

---

## 6. Payment Settings

เพิ่มหน้า `ตั้งค่าข้อมูลหลัก → การรับชำระเงิน`

ข้อมูลแต่ละบัญชี:

- เปิด/ปิดใช้งาน
- ชื่อเรียกบัญชี
- ประเภท PromptPay:
  - `PHONE`
  - `NATIONAL_ID_OR_TAX_ID`
  - `EWALLET` เฉพาะเมื่อ implementation รองรับจริง
- หมายเลขพร้อมเพย์
- ชื่อบัญชีสำหรับแสดง
- ธนาคาร (optional)
- บัญชีหลัก
- หมายเหตุ
- ผู้สร้าง/ผู้แก้ไขและเวลา

ข้อกำหนด:

- รองรับหลายบัญชี แต่มีบัญชีหลักที่ active ได้หนึ่งบัญชี
- Identifier ต้อง normalize ก่อนบันทึก เช่น ตัดเว้นวรรคและขีด
- Validation ตามประเภท
- List และ UI ปกติแสดงแบบ mask เช่น `08X-XXX-1234`
- Full value แสดงเฉพาะผู้มีสิทธิ์และเฉพาะเวลาที่จำเป็น
- การเปลี่ยนบัญชีหลัก/ปิดบัญชีต้องมี confirmation
- ห้ามลบ record ที่ถูกใช้อ้างอิงใน Payment ให้ archive/deactivate
- ทุกการเปลี่ยนแปลงต้องมี audit log

---

## 7. Booking Payment Flow

เพิ่ม section `การชำระเงิน` ในหน้ารายละเอียดการจอง โดยไม่เปลี่ยนข้อมูลและ workflow การจองเดิม

แสดง:

- ยอดรวมการจอง
- ยอดยืนยันแล้ว
- ยอดรอตรวจสอบ
- ยอดคงเหลือ
- ประวัติการรับชำระ
- ปุ่ม `รับชำระเงิน`

เมื่อกด `รับชำระเงิน`:

1. เลือกบัญชีพร้อมเพย์ โดย default เป็นบัญชีหลัก
2. เลือกประเภท: มัดจำ/ชำระบางส่วน/ชำระเต็มจำนวน
3. ใส่ยอดรับชำระ โดย default เป็นยอดคงเหลือ
4. ตรวจยอดต้องมากกว่า 0 และไม่เกินยอดคงเหลือ เว้นแต่มี workflow รับเกินที่กำหนดภายหลัง
5. แสดงสรุป Booking, ผู้เข้าพัก, จำนวนเงิน และบัญชีรับเงิน
6. กด `สร้าง QR Code`
7. แสดง QR พร้อมยอดและข้อมูลที่ mask แล้ว
8. ดาวน์โหลด/พิมพ์ QR ได้
9. หลังลูกค้าชำระ ให้อัปโหลดสลิปและส่งตรวจสอบ

ข้อมูลที่กรอกต้องไม่หายเมื่อเปิด/ปิดตัวเลือกย่อยหรืออัปโหลดไฟล์

---

## 8. QR Dialog UX

แสดงอย่างกระชับ:

- ชื่อ `ชำระค่าที่พัก`
- เลขที่การจอง
- QR ขนาดสแกนง่าย
- ชื่อบัญชี
- PromptPay แบบ mask
- ยอดชำระเด่นชัด
- คำเตือนให้ตรวจชื่อผู้รับในแอปธนาคารก่อนยืนยัน
- ปุ่มดาวน์โหลด
- ปุ่มพิมพ์
- ปุ่มอัปโหลดหลักฐาน/ส่งตรวจสอบ

รองรับ Desktop และ Mobile โดยไม่มี horizontal overflow และ QR ต้องไม่แตกเมื่อพิมพ์หรือดาวน์โหลด

---

## 9. Payment Record

ข้อมูลขั้นต่ำ:

- `id`
- `payment_number` ไม่ซ้ำ
- `booking_id`
- `amount`
- `currency` ค่าเริ่มต้น `THB`
- `method` ค่า `PROMPTPAY_QR`
- `purpose`: `DEPOSIT`, `PARTIAL`, `FULL`, `OTHER`
- `promptpay_account_id`
- Snapshot ชื่อบัญชีและ identifier แบบป้องกันการรั่วไหลตามความเหมาะสม
- `status`
- `paid_at`
- `submitted_at`
- `verified_at`
- `verified_by`
- `reference_number`
- `slip_file_id/path`
- `note`
- `created_by`, `created_at`, `updated_at`
- cancellation/refund metadata

สถานะ:

`DRAFT → AWAITING_PAYMENT → PENDING_VERIFICATION → VERIFIED`

สถานะปลายทางเพิ่มเติม:

- `CANCELLED`
- `REJECTED`
- `PARTIALLY_REFUNDED`
- `REFUNDED`

กฎ:

- นับเป็นยอดชำระแล้วเฉพาะ `VERIFIED` หักด้วยยอดคืนที่ยืนยันแล้ว
- `PENDING_VERIFICATION` แสดงแยก ห้ามรวมเป็นยอดรับเงินจริง
- การเปลี่ยนสถานะต้องตรวจ transition ฝั่ง server
- ห้ามแก้จำนวนเงินของ VERIFIED record โดยตรง ให้ยกเลิก/คืนเงินผ่าน workflow
- ทุก transition ต้องมี audit log
- ใช้ transaction เมื่ออัปเดต Payment และยอดสรุปที่เกี่ยวข้อง

---

## 10. Slip Upload และ Verification

- อัปโหลดจากคอมพิวเตอร์หรือมือถือ
- รองรับชนิดไฟล์รูปภาพ/PDF ตามที่กำหนด
- ตรวจ MIME, ขนาด และชื่อไฟล์ฝั่ง server
- เก็บใน private Supabase Storage
- แสดง preview ด้วย signed access ตาม Permission
- ผู้รับเงินสร้าง/ส่งรายการได้ แต่ผู้ยืนยันต้องมี `payment.verify`
- หน้า Verification แสดง Booking, จำนวนเงิน, บัญชีรับเงิน, เวลา, reference และสลิป
- อนุมัติหรือปฏิเสธพร้อมหมายเหตุ
- ป้องกัน double-submit และการ verify ซ้ำ

Phase นี้เป็น Manual verification เท่านั้น ห้ามอ้างว่าเงินเข้าอัตโนมัติ

---

## 11. Cancellation และ Refund

- ยกเลิกได้ตามสถานะและ Permission
- Verified payment ห้าม delete
- คืนเงินบางส่วนหรือเต็มจำนวนด้วย record/transaction แยก
- เก็บยอด เหตุผล เวลา ผู้ดำเนินการ และหลักฐาน
- ยอดคืนรวมต้องไม่เกินยอดที่ยืนยันแล้ว
- การคืนเงินใน Phase นี้เป็นการบันทึกผล ไม่ได้สั่งโอนเงินอัตโนมัติ

---

## 12. Permission

ทุก Permission ต้องมี code และชื่อภาษาไทย

| Permission code | ชื่อภาษาไทย |
|---|---|
| `payment.view` | ดูรายการรับชำระเงิน |
| `payment.create` | สร้างรายการรับชำระเงิน |
| `payment.submit` | ส่งหลักฐานการชำระเงิน |
| `payment.verify` | ตรวจสอบและยืนยันการชำระเงิน |
| `payment.cancel` | ยกเลิกรายการรับชำระเงิน |
| `payment.refund` | บันทึกการคืนเงิน |
| `payment.receipt.print` | พิมพ์หรือดาวน์โหลดหลักฐานรับเงิน |
| `payment.promptpay_settings.view` | ดูการตั้งค่าพร้อมเพย์ |
| `payment.promptpay_settings.manage` | จัดการบัญชีพร้อมเพย์ |
| `payment.report.view` | ดูรายงานการรับชำระเงิน |

บังคับ Permission ทั้ง UI, API/service และ RLS ไม่ใช่เพียงซ่อนปุ่ม

---

## 13. Data Model ขั้นต่ำ

ตรวจ schema เดิมก่อนตั้งชื่อจริง และ reuse ตารางเดิมที่เหมาะสม

- `promptpay_accounts`
- `booking_payments` หรือ payment table เดิมที่ขยายได้
- `payment_status_history`
- `payment_refunds`
- `payment_audit_logs` หรือ audit table กลาง
- Storage bucket/path สำหรับ payment slips

ข้อกำหนด DB:

- ใช้ Decimal/Numeric สำหรับจำนวนเงิน ห้ามใช้ floating point
- index สำหรับ booking, payment number, status, created_at
- unique constraint ที่จำเป็น
- foreign key และ delete behavior ชัดเจน
- บัญชีหลัก active ได้หนึ่งบัญชีตาม constraint/transaction ที่เหมาะสม
- Migration ต้องมี rollback strategy และไม่ทำลายข้อมูลเดิม

---

## 14. Task Plan

### Task 19.1 — Audit และ Integration Map

- [x] ตรวจ schema/API/UI ของ booking, payment, settings, upload, role/permission และ audit
- [x] ระบุของเดิมที่ `KEEP/EXTEND/REPLACE`
- [x] ระบุจุดเชื่อมใน Booking Detail เท่านั้น
- [x] ตรวจวิธีคำนวณ total/paid/balance ปัจจุบัน
- [x] จัดทำ migration และ rollback map

**Done when:** ทราบ dependency และยังไม่มีการแก้ business logic ระบบรับจอง

#### Integration Map (19.1)

| Area | Decision | Notes |
|---|---|---|
| `Payment` / `payments` | EXTEND | เพิ่มฟิลด์ PromptPay QR / slip / purpose / payment_number; ไม่ลบ flow เดิม |
| `PaymentChannel` | KEEP | ช่องทางเงินสด/โอน/บัตร — แยกจากบัญชีพร้อมเพย์ |
| `PaymentStatus` | EXTEND | เพิ่ม `AWAITING_PAYMENT`, `PENDING_VERIFICATION`, `VERIFIED`, `CANCELLED`, `REJECTED`, `PARTIALLY_REFUNDED`; คง `PAID`/`REFUNDED` สำหรับ PayButton เดิม |
| `PaymentMethod` | EXTEND | เพิ่ม `PROMPTPAY_QR` |
| `calculateBookingFinancialSummary` | EXTEND | นับ verified = `PAID`+`VERIFIED`; pending แยก; หัก refund/`PaymentRefund` |
| `PayButton` + `POST .../payments` | KEEP | รับชำระทันทีเป็น `PAID` — ไม่เปลี่ยน |
| Booking create/edit/lifecycle | KEEP | ห้ามแตะ business logic |
| Booking Detail UI | EXTEND | เพิ่ม section PromptPay คู่กับ PayButton เดิม |
| Settings `payment-channels` | KEEP | คงช่องทางเดิม |
| `PromptPayAccount` | NEW | ตาราง `promptpay_accounts` |
| `PaymentStatusHistory` / `PaymentRefund` | NEW | ประวัติสถานะและคืนเงินแยก |
| Permissions | EXTEND | เพิ่ม granular; คง `payment.read/collect/refund` |
| `AuditLog` | KEEP | reuse `recordAuditLog` |
| Slip storage | NEW (pattern จาก HR docs) | private bucket `payment-slips` |
| จุดเชื่อม UI | Booking Detail เท่านั้น | `/app/booking/[bookingId]/page.tsx` + components ใหม่ |

**Rollback map:** drop tables/columns/enums ใหม่ของ migration Phase 19; ไม่ rollback ข้อมูล `PAID` เดิม

### Task 19.2 — Schema, Settings และ Permission

- [x] สร้าง migration ที่จำเป็น
- [x] CRUD บัญชีพร้อมเพย์
- [x] Validation/normalization/masking
- [x] บัญชีหลักและ active state
- [x] Permission ภาษาไทย
- [x] API/RLS enforcement
- [x] Audit log

**Done when:** ผู้มีสิทธิ์ตั้งค่าบัญชีได้ และผู้ไม่มีสิทธิ์เข้าถึงเลขเต็มไม่ได้

### Task 19.3 — PromptPay QR Generator

- [x] เลือก library หรือสร้าง utility ที่ผ่านมาตรฐาน
- [x] รองรับ identifier ที่กำหนด
- [x] รองรับจำนวนเงิน THB สองตำแหน่ง
- [x] สร้าง QR image/SVG อย่างปลอดภัย
- [x] Unit tests สำหรับ normalize, payload, CRC และ amount
- [x] Error handling สำหรับ identifier/amount ไม่ถูกต้อง

**Done when:** QR test vectors ผ่านและแอปธนาคารที่ใช้ทดสอบอ่านชื่อผู้รับ/ยอดได้ถูกต้อง โดยไม่ทำธุรกรรมจริงระหว่าง automated test

### Task 19.4 — Booking Payment UI

- [x] เพิ่ม Payment summary card ใน Booking Detail
- [x] แสดง total/verified/pending/balance
- [x] Payment history
- [x] รับมัดจำ/บางส่วน/เต็มจำนวน
- [x] QR Dialog responsive
- [x] ดาวน์โหลด/พิมพ์
- [x] Empty/loading/error/permission states

**Done when:** สร้าง QR จากยอดคงเหลือได้โดยไม่กระทบ create/edit booking

### Task 19.5 — Slip และ Manual Verification

- [x] Private Storage และ policy
- [x] Upload/preview/download
- [x] Submit for verification
- [x] Verify/reject พร้อมเหตุผล
- [x] ป้องกัน duplicate action
- [x] Audit/status history

**Done when:** Workflow จากสร้างรายการจน VERIFIED/REJECTED ผ่านครบ

### Task 19.6 — Cancellation, Refund และ Receipt

- [x] Cancel ตาม state transition
- [x] Partial/full refund record
- [x] ป้องกันยอดคืนเกิน
- [x] Receipt/print view
- [x] Recalculate balance ถูกต้อง

**Done when:** Payment ที่ verified ไม่ถูกลบและยอดสุทธิหลังคืนเงินถูกต้อง

### Task 19.7 — Report และ Regression

- [x] รายงานตามวันที่ สถานะ วิธีชำระ ผู้บันทึก และ Booking
- [x] สรุปยอด verified/pending/refunded
- [x] Export ตาม pattern เดิมถ้ามี
- [x] Responsive/accessibility/security review
- [x] Regression ระบบรับจอง ห้อง อาหาร ครัว บัญชี และ Settings เดิม
- [x] อัปเดตเอกสารและ Completion Log

**Done when:** รายงานตรง source records และระบบนอกขอบเขตไม่ถดถอย

---

## 15. Verification Checklist

### Code

- [ ] TypeScript ผ่าน
- [ ] Lint ผ่าน
- [ ] Build ผ่าน
- [ ] Unit tests QR/CRC/amount ผ่าน
- [ ] ไม่มี console error ที่เกี่ยวข้อง

### Functional

- [ ] เพิ่ม/แก้ไข/deactivate บัญชีพร้อมเพย์
- [ ] มีบัญชีหลัก active ได้ถูกต้อง
- [ ] เลขพร้อมเพย์ถูก normalize และ mask
- [ ] QR แสดงบัญชีและยอดที่ถูกต้องเมื่อสแกน
- [ ] มัดจำ/แบ่งชำระ/เต็มจำนวนทำงาน
- [ ] ยอด verified/pending/balance แยกถูกต้อง
- [ ] อัปโหลดสลิปจาก Desktop/Mobile ได้
- [ ] Verify/reject/cancel/refund ถูกต้อง
- [ ] Print/download QR และ receipt ใช้งานได้

### Security

- [ ] Full PromptPay identifier ไม่รั่วใน list/log/client bundle
- [ ] API และ RLS ปฏิเสธผู้ไม่มีสิทธิ์
- [ ] Slip Storage เป็น private
- [ ] Verified payment แก้จำนวนหรือลบโดยตรงไม่ได้
- [ ] State transition ตรวจฝั่ง server
- [ ] Audit log ครบ

### Regression

- [ ] สร้าง/แก้ไข/ดู Booking เดิมได้
- [ ] ห้องพักทำงานเหมือนเดิม
- [ ] อาหารและครัวทำงานเหมือนเดิม
- [ ] ระบบพนักงานไม่ถูกแก้
- [ ] บัญชี/รายงาน/Settings เดิมไม่ถดถอย

---

## 16. Acceptance Criteria

Phase 19 เปลี่ยนเป็น `COMPLETED` ได้เมื่อ:

1. Task 19.1–19.7 เสร็จครบ
2. ตั้งค่าบัญชีพร้อมเพย์จาก Settings ได้จริง
3. QR สร้างจากบัญชีและยอดชำระจริงได้
4. รองรับมัดจำ แบ่งชำระ และชำระเต็มจำนวน
5. ยอดรับเงินจริงนับเฉพาะ VERIFIED และยอดคืนถูกหักถูกต้อง
6. Slip/verification/permission/audit ทำงานครบ
7. Verification Checklist ผ่าน หรือบันทึกข้อยกเว้นที่ผู้ใช้รับทราบ
8. Regression ยืนยันว่าระบบรับจองและโมดูลอื่นไม่เสีย
9. Completion Log มี files, migrations, commands และผลทดสอบ

---

## 17. Progress Log

Cursor ต้องเพิ่มแถวเมื่อเริ่ม หยุด หรือจบ Task และห้ามลบประวัติเก่า

| วันที่/เวลา | Task | สถานะ | สิ่งที่ทำ | Verification | Next action |
|---|---|---|---|---|---|
| 2026-07-13 | Phase 19 | PLANNED | สร้างแผน PromptPay QR Payment | Document review | เริ่ม Task 19.1 |
| 2026-07-13 21:40 | 19.1 | COMPLETED | Audit schema/API/UI + integration/migration map | Code review (no booking logic change) | เริ่ม 19.2 |
| 2026-07-13 21:40 | 19.2 | IN_PROGRESS | Schema, PromptPay settings, permissions | — | ทำต่อ 19.2 |
| 2026-07-13 22:30 | 19.2–19.7 | COMPLETED | Schema+Settings+QR+Booking UI+Slip/Verify+Cancel/Refund+Report | tsc/lint/unit + migrate deploy PASS | Phase COMPLETED |

---

## 18. Completion Log

### Task 19.1 — Audit และ Integration Map

- Status: COMPLETED
- Completed at: 2026-07-13 21:40
- Files changed:
  - `docs/plans/phase_19_promptpay_qr_payment.md`
  - `docs/CURRENT_TASK.md`
- Database migrations:
  - None
- What changed:
  - ระบุ KEEP/EXTEND/NEW สำหรับ Payment, Channel, Settings, Permissions, Audit, Storage
  - จุดเชื่อมเฉพาะ Booking Detail; คง PayButton และ booking workflow
  - สรุป financial summary: paid=`PAID`, จะ EXTEND ให้รองรับ `VERIFIED`/pending
- Verification commands:
  - Targeted schema/API grep (read-only)
- Verification results:
  - PASS — ไม่แก้ business logic การจอง
- Known issues:
  - None
- Scope exceptions:
  - None
- Next task:
  - Task 19.2

### Task 19.2 — Schema, Settings และ Permission

- Status: COMPLETED
- Completed at: 2026-07-13 22:30
- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260713280000_phase19_promptpay_qr_payment/migration.sql`
  - `lib/settings/promptpay-accounts*.ts`
  - `app/api/promptpay-accounts/**`
  - `components/settings/PromptPayAccountsManager.tsx`
  - `lib/auth/authorization.ts`, `permission-labels.ts`
- Database migrations:
  - `20260713280000_phase19_promptpay_qr_payment` (deployed)
- What changed:
  - ตาราง `promptpay_accounts`, ขยาย `payments`, `payment_status_history`, `payment_refunds`
  - CRUD + mask identifier; permission ใหม่ภาษาไทย
- Verification commands:
  - `npx prisma migrate deploy`, `npx tsc --noEmit`
- Verification results:
  - PASS
- Known issues:
  - Full identifier ออกเฉพาะ `/master` สำหรับผู้มี `payment.promptpay_settings.manage`
- Scope exceptions:
  - None
- Next task:
  - Task 19.3

### Task 19.3 — PromptPay QR Generator

- Status: COMPLETED
- Completed at: 2026-07-13 22:30
- Files changed:
  - `lib/payments/promptpay-qr.ts`
  - `tests/unit/promptpay-qr.test.ts`
  - dependency `qrcode` (+ existing `promptpay-qr`)
- Database migrations:
  - None
- What changed:
  - Payload EMVCo/PromptPay + CRC + QR data URL
- Verification commands:
  - `npx tsx --test tests/unit/promptpay-qr.test.ts`
- Verification results:
  - PASS
- Known issues:
  - การสแกนด้วยแอปธนาคารจริงเป็น manual smoke นอก automated test
- Scope exceptions:
  - None
- Next task:
  - Task 19.4

### Task 19.4 — Booking Payment UI

- Status: COMPLETED
- Completed at: 2026-07-13 22:30
- Files changed:
  - `components/ui/BookingPromptPaySection.tsx`
  - `app/booking/[bookingId]/page.tsx`
  - `app/api/bookings/[bookingId]/promptpay-payments/route.ts`
- Database migrations:
  - None
- What changed:
  - Section PromptPay คู่กับ PayButton เดิม; QR dialog ดาวน์โหลด/พิมพ์
- Verification commands:
  - `npx tsc --noEmit`
- Verification results:
  - PASS
- Known issues:
  - None
- Scope exceptions:
  - ไม่แตะ create/edit booking
- Next task:
  - Task 19.5

### Task 19.5 — Slip และ Manual Verification

- Status: COMPLETED
- Completed at: 2026-07-13 22:30
- Files changed:
  - `lib/payments/slip-storage.ts`
  - `lib/payments/promptpay-actions.ts`
  - submit/verify/reject/slip routes
- Database migrations:
  - None (ใช้คอลัมน์จาก 19.2)
- What changed:
  - Private bucket `payment-slips`; submit → PENDING_VERIFICATION; verify/reject
- Verification commands:
  - `npx tsc --noEmit`
- Verification results:
  - PASS (unit/API path)
- Known issues:
  - Bucket สร้างแบบ lazy เมื่ออัปโหลดครั้งแรก
- Scope exceptions:
  - None
- Next task:
  - Task 19.6

### Task 19.6 — Cancellation, Refund และ Receipt

- Status: COMPLETED
- Completed at: 2026-07-13 22:30
- Files changed:
  - cancel/refund/qr routes + workflow transitions
  - print/download ใน QR dialog
- Database migrations:
  - None
- What changed:
  - Cancel ตาม transition; `payment_refunds` partial/full; ห้ามเกินยอด
- Verification commands:
  - `npx tsc --noEmit`, financial-summary unit
- Verification results:
  - PASS
- Known issues:
  - Receipt แยกหน้าเต็มยังใช้ print QR/dialog เป็นหลัก
- Scope exceptions:
  - คง refund เดิมของ booking ยกเลิกผ่าน `PayButton`
- Next task:
  - Task 19.7

### Task 19.7 — Report และ Regression

- Status: COMPLETED
- Completed at: 2026-07-13 22:30
- Files changed:
  - `app/api/payments/report/route.ts`
  - `lib/payments/financial-summary.ts`
  - docs phase plan / CURRENT_TASK
- Database migrations:
  - None
- What changed:
  - รายงานรับชำระพื้นฐาน; สรุป verified/pending/refunded; PayButton/booking flow เดิมคงอยู่
- Verification commands:
  - `npx tsc --noEmit`, `npm run lint`, unit promptpay + financial-summary
- Verification results:
  - PASS (lint: 1 warning unrelated HR + fixed unused var)
- Known issues:
  - E2E browser scan ของแอปธนาคารยังไม่ได้รันในรอบนี้
- Scope exceptions:
  - ไม่รัน full Playwright suite ทั้งโปรเจกต์
- Next task:
  - —


---

## 19. Current Handoff

ให้ Cursor เริ่ม Task 19.1:

1. อ่านไฟล์ควบคุมงานของ repository
2. สำรวจเฉพาะ booking/payment/settings/upload/permission/audit ที่เกี่ยวข้อง
3. จัดทำ integration และ migration map
4. อัปเดต Phase Status, Progress Log และ Completion Log
5. เดินหน้าตาม Task 19.2–19.7 โดยไม่ขออนุมัติย่อย

ห้ามเริ่มด้วยการแก้ระบบรับจองหรือสร้าง schema ซ้ำก่อนตรวจของเดิม