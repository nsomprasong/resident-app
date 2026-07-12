# Architecture Decision Records

## ADR-001: Next.js App Router

- สถานะ: ใช้งานอยู่
- หลักฐาน: `app/`, `app/layout.tsx`, Route Handlers
- การตัดสินใจ: ใช้ Next.js เป็นทั้ง UI และ HTTP backend ใน modular monolith
- เหตุผลจากโค้ด: ยังไม่พบเอกสารเหตุผลเดิม; โค้ดแสดงการรวม routing/rendering/API ใน repository เดียว
- ผล: deployment ง่าย แต่ต้องควบคุม client boundary และแยก business layer เมื่อระบบโต

## ADR-002: Supabase PostgreSQL

- สถานะ: ใช้งานอยู่ในฐานะ database host
- หลักฐาน: environment, CA, Prisma connection
- เหตุผลจากโค้ด: ยังไม่พบเหตุผลจากโค้ด
- ผล: ได้ managed PostgreSQL; Auth/RLS/Realtime ยังไม่ถูกใช้

## ADR-003: Prisma + PostgreSQL Adapter

- สถานะ: ใช้งานอยู่
- หลักฐาน: `prisma/schema.prisma`, `lib/prisma.ts`, migrations
- เหตุผลจากโค้ด: ยังไม่พบเหตุผลจากโค้ด
- ผล: type-safe access/migration; ต้องจัดการ Decimal, connection และ migration discipline

## ADR-004: Route Handlers แทน Server Actions

- สถานะ: ใช้งานอยู่
- หลักฐาน: `app/api/**/route.ts`; ยังไม่พบ Server Action
- เหตุผลจากโค้ด: ยังไม่พบเหตุผลจากโค้ด
- ผล: API contract เรียกจาก client ได้ชัด แต่ปัจจุบัน handler มี business logic มาก

## ADR-005: Redux Toolkit สำหรับ Client State บางส่วน

- สถานะ: ใช้งานอยู่
- หลักฐาน: `store/`, `hooks/useBasketList.ts`, `hooks/useBookingDetail.ts`
- เหตุผลจากโค้ด: ยังไม่พบเหตุผลจากโค้ด
- ผล: basket แชร์ข้ามหน้าได้; booking snapshot ซ้ำกับ server fetch บางส่วน

## ADR-006: Snapshot Pricing

- สถานะ: ใช้งานอยู่
- หลักฐาน: BookingRoom.rate, BookingRaft.rate, OrderItem.unitPrice, InspectionItem.unitPrice
- เหตุผลที่อนุมานได้จาก schema: รักษาราคา ณ เวลาธุรกรรม; ไม่มี ADR เดิมยืนยัน

ADR ใหม่ต้องมี context, options, decision, consequences, security/data/deployment impact และวัน/ผู้อนุมัติ.
