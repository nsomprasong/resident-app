# Project Context — Stable Summary

เปิดไฟล์นี้เมื่อจำเป็นต้องเข้าใจภาพรวม ห้ามอ่านซ้ำทุก task หาก `CURRENT_TASK.md` เพียงพอ

## Architecture

- Modular monolith บน Next.js App Router
- Client Components เรียก Route Handlers ผ่าน `fetch`
- Route Handlers ใช้ Prisma ติดต่อ Supabase PostgreSQL
- Supabase Auth + server-validated session middleware
- Redux Toolkit ใช้เฉพาะ client state บางส่วน เช่น basket/booking snapshot
- Business logic เดิมยังกระจายใน Route Handlers และ Client Components

## Domain

Booking, Guest, Tour Group, Room, Room Type, Zone, Raft, Package, Order, Charge, Payment, Refund, Inspection และ Employee

อย่าตีความจากชื่อ model อย่างเดียว ให้ยืนยันจาก Source Code, Prisma Schema และ test ที่เกี่ยวข้อง

## Implemented Foundation

Core booking, room/raft availability, package/extra pricing, food order creation, partial payment, refund, housekeeping inspection และ close job มี implementation แล้ว

Dashboard, Kitchen workflow, Employee schedule/wage, Reports/receipt/export และ Settings CRUD ยังไม่สมบูรณ์

## Security Baseline

- Authentication และ Employee mapping guard ผ่าน verification แล้ว
- Phase 2 RBAC อยู่ระหว่าง verification
- Server/API เป็น authoritative permission boundary
- Unknown role ต้อง deny
- Supabase RLS, least-privilege DB role และ audit log ยังไม่ครบ production baseline
- ห้าม log token, password, connection string, PII หรือ payment details

## Business/Integrity Rules

- Server ต้องเป็น source of truth สำหรับราคา ยอดเงิน permission และ status
- Availability, payment และ refund ต้องพิจารณา transaction/concurrency
- Financial calculation ต้องมี source of truth เดียวและ tests
- Request body/query/path ที่เป็น trust boundary ต้องมี runtime validation
- Date-related logic ต้องตรวจ timezone และ boundary; project timezone คือ Asia/Bangkok เว้นแต่ code ระบุอื่น
- รักษา backward compatibility หาก requirement ไม่อนุญาต breaking change

## Coding Rules

- TypeScript strict; no `any`
- ใช้ explicit/named types สำหรับ DTO/Props ซับซ้อน
- Prefer Server Components เมื่อไม่ต้องใช้ client capability
- Prefer small reversible changes
- ไม่ duplicate business calculation
- ไม่สร้าง dead code/commented implementation
- Error response ต้องไม่เปิด stack/secret
- ใช้ select/pagination/index เมื่อ query โตได้; ระวัง N+1

## Current Project Risks

- RBAC API/page coverage ยังไม่ verified ครบ
- RLS/least privilege ยังไม่ครบ
- Runtime validation/error contract ยังไม่รวมศูนย์
- Audit trail สำหรับ financial/lifecycle operations ยังไม่ครบ
- Automated tests/CI ยังไม่ครอบคลุมทุก domain
- Working tree อาจมี user changes จำนวนมาก ต้องตรวจและรักษาเสมอ

## Source-of-Truth Order

1. Current Source Code และ Prisma Schema
2. Tests ที่รันได้จริง
3. `docs/CURRENT_TASK.md`
4. `docs/reference/` ตามหัวข้องาน
5. `docs/archive/` เฉพาะประวัติหรือเมื่อผู้ใช้สั่ง
