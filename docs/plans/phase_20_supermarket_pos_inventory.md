# Phase 20 — ระบบขายหน้าร้านซูเปอร์มาร์เก็ต (Supermarket POS & Inventory)

## สถานะ

- Phase: 20
- Status: `COMPLETED`
- Progress: `100%`
- ผู้รับผิดชอบดำเนินการ: Cursor
- ขอบเขต: ระบบสินค้าไม่ใช่อาหาร, สต๊อก, POS, กะเงินสด, รายงาน, บัญชี และ Dashboard

## เป้าหมาย

สร้างระบบขายสินค้าหน้าร้านแบบครบวงจร แยกสินค้าออกจากเมนูอาหารและสต๊อกครัวอย่างชัดเจน รองรับการสแกนบาร์โค้ดหรือเลือกสินค้าจากหน้าจอ ตัดสต๊อกอัตโนมัติ รับชำระเงินสด/PromptPay/โอนเงิน หรือโอนยอดไปยังห้องพักและกรุ๊ปทัวร์ พร้อมส่งข้อมูลสรุปเข้าสู่ระบบบัญชีและ Dashboard

## หลักการสำคัญ

1. สินค้าซูเปอร์มาร์เก็ตต้องไม่ใช้ตารางหรือ API เดียวกับเมนูอาหารและวัตถุดิบครัว
2. การเปลี่ยนแปลงสต๊อกทุกครั้งต้องมีเอกสารอ้างอิงและประวัติย้อนหลัง
3. การขาย การคืนสินค้า และการยกเลิกบิลต้องทำใน transaction เพื่อป้องกันยอดเงินหรือสต๊อกไม่ตรงกัน
4. ห้ามลบประวัติการขาย สต๊อก และกะเงินสดแบบถาวรจากหน้าระบบ
5. จำนวนเงินต้องใช้ชนิด `Decimal` ห้ามใช้ floating point
6. การส่งยอดเข้าบัญชี ห้องพัก หรือกรุ๊ปทัวร์ต้องป้องกันข้อมูลซ้ำด้วย reference/idempotency key
7. ทุกหน้าและ API ต้องตรวจสอบ permission ฝั่ง server ไม่พึ่งการซ่อนเมนูเพียงอย่างเดียว
8. UI ต้องใช้ design tokens กลางตาม `DESIGN.md` และรองรับ desktop, tablet และ mobile

## Permission ที่ใช้จริง (dotted, ตรง RBAC เดิม)

| Permission | ชื่อภาษาไทย |
| --- | --- |
| `pos.view` | เข้าถึงหน้าขายซูเปอร์มาร์เก็ต |
| `pos.sell` | บันทึกการขายซูเปอร์มาร์เก็ต |
| `pos.discount` | ให้ส่วนลดการขาย |
| `pos.hold` | พักและเรียกบิลขาย |
| `pos.cancel` | ยกเลิกบิลขาย |
| `pos.refund` | คืนสินค้าและคืนเงิน |
| `pos.shift.open` | เปิดกะขาย |
| `pos.shift.close` | ปิดกะขาย |
| `pos.shift.approve` | ตรวจสอบและอนุมัติกะขาย |
| `pos.product.view` | ดูข้อมูลสินค้าซูเปอร์มาร์เก็ต |
| `pos.product.manage` | จัดการสินค้าและหมวดหมู่ซูเปอร์มาร์เก็ต |
| `pos.stock.view` | ดูสต๊อกและประวัติสินค้า |
| `pos.stock.receive` | รับสินค้าเข้าสต๊อก |
| `pos.stock.adjust` | ปรับยอดสต๊อก |
| `pos.stock.count` | ตรวจนับสต๊อก |
| `pos.report.view` | ดูรายงานยอดขายซูเปอร์มาร์เก็ต |
| `pos.accounting.post` | ส่งรายการขายเข้าบัญชี |
| `pos.settings.manage` | จัดการตั้งค่าระบบขาย |

## Acceptance Criteria

- [x] สินค้าซูเปอร์มาร์เก็ตแยกจากเมนูอาหารและสต๊อกครัว (`pos_products` ≠ `products`)
- [x] เพิ่ม แก้ไข ค้นหา และปิดใช้งานสินค้า/หมวดหมู่ได้
- [x] SKU และบาร์โค้ดไม่ซ้ำ (unique constraints)
- [x] รับเข้า ปรับยอด ตรวจนับ และดูประวัติสต๊อกได้
- [x] ขายด้วยการสแกนบาร์โค้ดหรือเลือกสินค้าจากหน้าจอได้
- [x] การขายสำเร็จตัดสต๊อกเพียงครั้งเดียว (idempotencyKey + stock movement SALE)
- [x] ระบบป้องกันสต๊อกติดลบตาม Settings
- [x] เปิดกะพร้อมเงินทอนตั้งต้นและปิดกะพร้อมตรวจยอดได้
- [x] รับเงินสด PromptPay เงินโอน และลงห้อง/กรุ๊ปได้
- [x] ลงยอดไปยังห้องพักหรือกรุ๊ปทัวร์และป้องกันรายการซ้ำ (`Charge.sourceType/sourceId`)
- [x] คืนสินค้า/ยกเลิกบิลแล้วสต๊อกและยอดปลายทางถูกต้อง (กลับรายการ Charge + accounting)
- [x] มีใบเสร็จและเลขที่เอกสารไม่ซ้ำ (`PosReceiptSequence`)
- [x] รายงานยอดขาย สต๊อก กำไรขั้นต้น และกะเงินสด
- [x] รายการบัญชี `pos_accounting_entries` อ้างกลับบิล/กะได้
- [x] Dashboard แสดงสรุป POS โดยไม่กระทบข้อมูลเดิม
- [x] Permission ฝั่ง UI และ API
- [x] มีภาษาไทยกำกับ Permission ทุกตัว
- [x] Type check และ automated unit tests ที่เกี่ยวข้องผ่าน
- [x] ทดสอบบน desktop/tablet/mobile โดยผู้ใช้จริง (ผู้ใช้อนุมัติปิด Phase)

## Out of Scope (คงตามแผนเดิม)

- จัดซื้อเต็มรูปแบบ, supplier portal, สมาชิก/แต้ม, หลายสาขา, EDC gateway, native printer driver, รวมวัตถุดิบครัว

## Progress Log

| Task | สถานะ | วันที่ | หมายเหตุ |
| --- | --- | --- | --- |
| 20.1 วิเคราะห์และออกแบบฐานข้อมูล | `DONE` | 2026-07-14 | schema `pos_*` + Charge.SUPERMARKET |
| 20.2 Product Master | `DONE` | 2026-07-14 | API/UI สินค้าและหมวด |
| 20.3 Stock Management | `DONE` | 2026-07-14 | receive/adjust/count/ledger |
| 20.4 POS และ Barcode | `DONE` | 2026-07-14 | `/pos` terminal |
| 20.5 Shift, Payment และ Receipt | `DONE` | 2026-07-14 | กะ + ชำระ + ใบเสร็จ |
| 20.6 Room และ Tour Charge | `DONE` | 2026-07-14 | Charge + idempotency |
| 20.7 Refund และ Cancellation | `DONE` | 2026-07-14 | คืนสต๊อก + กลับรายการ |
| 20.8 Accounting, Reports และ Dashboard | `DONE` | 2026-07-14 | reports + dashboard widgets |
| 20.9 Verification และ Documentation | `DONE` | 2026-07-14 | migrate deploy + unit tests + docs |

## Verification (รันจริง)

- `npx prisma migrate deploy` — applied `20260714140000_phase20_supermarket_pos`
- `npm run typecheck` — pass
- `npx tsx --test` POS + permission menu groups — pass
- `npm run lint` — no errors (warning อื่นนอกขอบเขต)
- `npm run build` — compile สำเร็จ; ล้มที่ EPERM เขียน `.next/trace` (สภาพแวดล้อมเครื่อง)

## Completion

- ผู้ใช้อนุมัติปิด Phase: 2026-07-14
- Status: `COMPLETED`
