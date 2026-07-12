# Security Guide

## Baseline ปัจจุบัน

ระบบยังไม่มี Authentication, Authorization และ RLS; `.env.example` เคยถูกตรวจพบว่ามี credential จริง จึงต้องถือว่า production readiness ด้าน Security ยังไม่ผ่าน.

## Authentication

ใช้ Supabase Auth/session ที่ตรวจฝั่ง server. Token/session ต้องมี expiry, secure cookie, SameSite และ logout/revocation. ห้ามเชื่อ user identity จาก request body.

## Authorization

กำหนด RBAC อย่างน้อย Front Desk, Housekeeping, Kitchen, Accounting, Admin. ทุก mutation ตรวจ role และ resource scope; Payment/Refund/PaymentChannel/Master Data ต้องสิทธิ์สูงและมี approval/audit ตามความเสี่ยง.

## Input Validation

ใช้ runtime schema ต่อ endpoint, จำกัดขนาด/ความยาว/รูปแบบ/enum/UUID/Decimal. ราคาและสถานะต้องอ่านจาก server. Encode output ตาม context; ห้ามใช้ raw HTML.

## Supabase RLS

เปิด RLS เมื่อ client access มีขึ้น; policy ต้อง default deny. Server database role ใช้ least privilege และแยก migration/runtime credential. Repository ปัจจุบันยังไม่พบ policy.

## Secrets/Environment

ห้าม secret ใน Git, `.env.example`, `NEXT_PUBLIC_*`, log หรือ docs. เมื่อพบ leakage: revoke/rotate, ตรวจ history โดยไม่เปิดเผยค่า, purge เมื่อพบหลักฐานและได้รับอนุมัติ, audit access และบันทึก incident. CA certificate ไม่ใช่ secret แต่ต้องตรวจ integrity.

## Web/API Controls

เพิ่ม CSRF strategy, rate limiting, security headers, request ID, audit log, idempotency key สำหรับเงิน, safe error response และ monitoring. ทดสอบ OWASP Top 10 และ dependency vulnerability ใน CI.
