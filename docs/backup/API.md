# API Reference

## Authentication Status

Session refresh middleware พร้อมแล้ว แต่ business API routes ยังไม่ enforce authentication ใน Task 1.3 ห้ามถือว่าการมี cookie refresh เป็น authorization; endpoint guards จะเพิ่มหลัง Login/Logout flow พร้อม

หน้า `/login` ใช้ Server Action เรียก Email/Password sign-in. Initial Employee mapping และ business API guards พร้อมแล้ว

Logout เปลี่ยนเป็น `POST /api/auth/logout` และ redirect 303 ไป `/login` เพื่อไม่พึ่ง build-specific Server Action ID

Business APIs ต้องมี verified Supabase session; request ที่ไม่มี session คืน `401` JSON `{ "message": "Authentication required" }`. Phase 2 เพิ่ม explicit API permission mapping และคืน `403` เมื่อสิทธิ์ไม่พอ

`GET /api/auth/me` คืน `{ employee: { name, role } }` สำหรับ mapped authenticated user, คืน 401 เมื่อไม่มี session และ 403 เมื่อไม่มี Employee mapping

ทุก endpoint เป็น Next.js Route Handler และคืน JSON. Authentication/Authorization: ยังไม่พบการ Implement ในทุก endpoint. Server Action: ยังไม่พบการ Implement.

| Method/Route | Purpose | Input หลัก | Output/Validation/Error |
|---|---|---|---|
| GET `/api/bookings` | รายการตามวันหรือ history | `date`, `history=true` | booking summary; 400 วันผิด, 500 query fail |
| POST `/api/bookings` | สร้างรายเดี่ยว/กลุ่ม | mode, identity, dates, roomIds/raftIds, package/food | 201 id/reference; ตรวจวันย้อนหลัง, resource, conflict, product |
| GET `/api/bookings/:id` | รายละเอียดและยอด | path id | guest/group, resources, charges, orders, payments/refunds, totals, transitions |
| PATCH `/api/bookings/:id` | เปลี่ยน lifecycle หรือปิดงาน | `{status}` หรือ `{closeJob:true}` | ตรวจ transition; checkout สร้าง inspections; close ต้องตรวจครบ |
| POST `/api/bookings/:id/resources` | เพิ่มห้อง/แพภายหลัง | roomIds, raftIds | ตรวจ booking ยังเปิด, duplicate/conflict; สร้าง extra charge |
| POST `/api/bookings/:id/payments` | รับเงินบางส่วน | amount, method/channelId, reference | ต้อง >0 และไม่เกิน outstanding; booking ห้าม cancelled |
| POST `/api/bookings/:id/refunds` | คืนเงินหลังยกเลิก | amount, channelId | ต้อง cancelled และไม่เกินยอดรับสุทธิ |
| GET `/api/rooms` | inventory/availability ห้อง | checkIn, checkOut | room, zone, type, booked; 400 ช่วงวันผิด |
| GET `/api/rafts` | inventory/availability แพ | checkIn, checkOut | raft และ booked flag |
| GET `/api/products` | รายการสินค้า active | optional `type` | normalized product card data |
| POST `/api/orders` | สร้างออเดอร์ | bookingId, item productId/note | group item, snapshot ราคา; booking ต้องไม่ cancelled/checked-out |
| GET `/api/inspection-catalog` | ราคากลางงานตรวจ active | ไม่มี | id/name/type/unitPrice |
| GET `/api/housekeeping/inspections` | งานห้องหลัง checkout ที่ยังไม่ปิด | ไม่มี | สร้าง inspection ที่ขาดแบบ side effect แล้วคืนรายการ |
| PATCH `/api/housekeeping/inspections/:id` | บันทึก/จบการตรวจ | notes, catalog items, complete | server re-price; upsert charge; complete ทำห้อง AVAILABLE |
| GET `/api/payment-channels` | ช่องทาง active | ไม่มี | id/name/method |
| POST `/api/payment-channels` | เพิ่ม/เปิดช่องทาง | name, PaymentMethod | upsert ตามชื่อ |

## รูปแบบ Validation

## Authorization

- Middleware ตรวจ Supabase session, Employee mapping และ method/path permission ก่อน Route Handler
- `/api/auth/me` ใช้ได้กับ Employee ที่ map แล้วทุก role; `/api/auth/logout` เป็น public cleanup endpoint
- API ที่ไม่มี explicit permission mapping ถูกปฏิเสธ `403` แบบ default deny
- Permission หลัก: booking read/write/lifecycle, resource read/manage, order write, payment collect/refund, inspection read/write, catalog read และ payment-channel manage
- API permission matrix อ้างอิง typed policy ใน `lib/auth/authorization.ts` และ Business Rule ใน `RBAC_PLAN.md`
- ขณะนี้ Admin regression ผ่าน แต่ cross-role allowed/forbidden E2E ยังรอ dedicated role test users

ใช้ TypeScript cast และเงื่อนไข manual; ยังไม่มี runtime schema validator กลาง. Error ส่วนใหญ่เป็น `{message:string}` พร้อม HTTP 400, 404, 409 หรือ 500. Handler สำคัญใช้ sentinel `Error("CODE")` ภายใน transaction แล้ว map เป็น response.

## ประเด็น API

- GET housekeeping มี write side effect (สร้าง inspection ที่ขาด) ขัดหลัก safe/idempotent GET แม้ผลลัพธ์เชิงธุรกิจทำซ้ำได้
- ไม่มี pagination, filtering แบบมาตรฐาน, request ID หรือ API version
- ไม่มี CSRF protection หรือ rate limit; permission checks มีที่ centralized middleware แต่ cross-role E2E ยังไม่ครบ
- การคำนวณ grand/paid ซ้ำในหลาย handler
- `POST /api/payment-channels` เปิดให้ผู้เรียกทั่วไปแก้ master data
