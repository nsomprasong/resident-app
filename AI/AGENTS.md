# คู่มือปฏิบัติงานถาวรสำหรับ AI Agent

เอกสารนี้เป็นคำสั่งหลักสำหรับ AI coding agent ทุกชนิดที่ทำงานใน repository นี้

Agent ต้องอ่านไฟล์นี้ก่อนวิเคราะห์ วางแผน หรือแก้ไขไฟล์ใด ๆ

รายละเอียดเชิงลึกให้อ้างอิงเอกสารใน `docs/` ห้ามคัดลอกหรือสร้างข้อเท็จจริงใหม่โดยไม่มีหลักฐาน

# Project Identity

## Purpose

Resident Hotel Management เป็นระบบจัดการที่พักสำหรับงานจองห้องและแพ ลูกค้ารายเดี่ยวและกลุ่ม อาหาร ค่าใช้จ่าย การรับและคืนเงิน และการตรวจห้องหลังเช็กเอาต์

อ่านรายละเอียดที่ `docs/PROJECT_OVERVIEW.md` และ `docs/BUSINESS_RULES.md`

## Current Status

- Core booking, room/raft availability, package pricing, food order, payment, refund และ housekeeping มี implementation แล้ว
- Dashboard, Kitchen, Employee Schedule, Wage, Report และ Settings ยังไม่สมบูรณ์
- Authentication, Authorization, Supabase RLS, automated tests และ audit log ยังไม่พบ implementation ที่สมบูรณ์
- ระบบยังไม่พร้อม Production จนกว่างาน Critical ใน `docs/TODO.md` จะได้รับการแก้ไข

## Architecture Summary

- รูปแบบหลักเป็น modular monolith บน Next.js App Router
- Client Components เรียก Next.js Route Handlers ผ่าน `fetch`
- Route Handlers ใช้ Prisma Client ติดต่อ Supabase PostgreSQL
- Redux Toolkit ใช้เฉพาะ client state บางส่วน เช่น basket และ booking snapshot
- Business Logic ปัจจุบันกระจายอยู่ใน Route Handlers และ Client Components

อ่านรายละเอียดที่ `docs/ARCHITECTURE.md` และ `docs/DECISIONS.md`

## Technology Stack

Next.js 15, React 19, TypeScript strict, Tailwind CSS 4, Prisma ORM 7, Supabase PostgreSQL, Redux Toolkit และ Lucide React

ตรวจเวอร์ชันจริงจาก `package.json` และ `docs/DEPENDENCIES.md`

## Business Domain

Domain สำคัญประกอบด้วย Booking, Guest, Tour Group, Room, Room Type, Zone, Raft, Package, Order, Charge, Payment, Refund และ Inspection

ห้ามตีความ Business Rule จากชื่อเพียงอย่างเดียว

อ่าน `docs/BUSINESS_RULES.md`, `docs/DATABASE.md` และ Source Code ที่เกี่ยวข้องก่อนเปลี่ยน behavior

# AI Responsibilities

## How AI Should Work

1. อ่านคำขอของผู้ใช้ทั้งหมด
2. อ่านเอกสารและ Source Code ที่เกี่ยวข้อง
3. แยก Fact, Inference และ Unknown ให้ชัดเจน
4. ตรวจ working tree และรักษาการแก้ไขเดิมของผู้ใช้
5. ระบุขอบเขต ผลกระทบ ความเสี่ยง และไฟล์ที่เกี่ยวข้อง
6. วางแผนก่อน implementation
7. อธิบายการเปลี่ยนแปลงสำคัญก่อนลงมือ
8. ทำงานเฉพาะขอบเขตที่ได้รับอนุญาต
9. ตรวจสอบผลจริงก่อนรายงานว่าสำเร็จ

## How AI Should Think

- Correctness และ Data Integrity มาก่อนความเร็ว
- Security และ Privacy เป็นข้อกำหนด ไม่ใช่ตัวเลือก
- เลือกการเปลี่ยนแปลงที่เล็ก ชัดเจน และย้อนกลับได้
- รักษา existing behavior เว้นแต่ requirement ระบุให้เปลี่ยน
- Server และ Database เป็น trust boundary สำหรับราคา สิทธิ์ และสถานะ
- อย่าแก้อาการโดยไม่ระบุ Root Cause

## How AI Should Analyze

- ตรวจ UI, API, Business Rule, Database, Security, Performance, Tests และ Documentation
- ตรวจผลกระทบต่อ Booking lifecycle และยอดเงินทุกครั้งที่เกี่ยวข้อง
- ตรวจ concurrency และ transaction สำหรับ availability, payment และ refund
- ตรวจ timezone และ date boundary สำหรับงานเกี่ยวกับวันเข้าพัก
- หากข้อมูลไม่พอ ให้ค้นจาก repository ก่อนถามผู้ใช้
- หากยังยืนยันไม่ได้ ให้บอกว่า “ยังไม่พบข้อมูลยืนยัน”

## How AI Should Explain

- ใช้ภาษาไทยเป็นหลัก
- Technical terms ใช้ภาษาอังกฤษได้เมื่อช่วยให้ชัดเจน
- นำด้วยผลลัพธ์หรือข้อค้นพบสำคัญ
- อธิบาย Trade-off และความเสี่ยงอย่างตรงไปตรงมา
- ห้ามอ้างว่าทดสอบผ่านหากไม่ได้รันจริง

## How AI Should Plan

- งานที่มีหลายขั้นต้องมีแผนที่ตรวจสอบได้
- แผนต้องระบุ Analysis, Implementation, Verification และ Documentation
- มีงาน `in_progress` ได้ครั้งละหนึ่งรายการ
- ปรับแผนเมื่อพบข้อเท็จจริงใหม่
- ไม่สร้างแผนใหญ่เกินขอบเขตคำขอ

# AI Development Workflow

## 1. Read Documentation

อ่านไฟล์นี้ก่อน แล้วเลือกอ่านเอกสารอ้างอิงตามประเภทงาน

หากเอกสารขัดกับ Source Code ให้ถือ Source Code และ Schema ปัจจุบันเป็นหลัก แล้วรายงานความคลาดเคลื่อน

## 2. Analyze

ยืนยัน current behavior, acceptance criteria, affected files, data impact, security impact และ regression risk

## 3. Plan

สร้างแผนสั้นและเป็นลำดับ

Database หรือ Architecture change ต้องมี migration/deployment/rollback consideration

## 4. Explain

แจ้งผู้ใช้ก่อนทำ major change, destructive action, schema migration, dependency installation หรือการเปลี่ยน public contract

## 5. Wait if Destructive

ต้องขออนุญาตก่อนลบข้อมูล reset database ลบไฟล์ rewrite history หรือทำ irreversible external action

ห้ามตีความคำสั่งทั่วไปเป็นสิทธิ์สำหรับ destructive action

## 6. Implement

แก้เฉพาะไฟล์ที่จำเป็น

รักษา user changes และหลีกเลี่ยง unrelated formatting/refactor

ใช้ transaction และ server-side validation เมื่อมีผลต่อข้อมูลหรือยอดเงิน

## 7. Build

รัน `npm run build`

หากรันไม่ได้ ต้องรายงานเหตุผลและห้ามกล่าวว่า Build ผ่าน

## 8. Test

รันอย่างน้อย:

- `npm run lint`
- TypeScript check ที่เหมาะสม
- Automated tests ที่เกี่ยวข้องเมื่อมี
- Manual smoke test ตามความเสี่ยง

อ่านแนวทางที่ `docs/TESTING_GUIDE.md`

## 9. Update Documentation

อัปเดตเอกสารที่ได้รับผลกระทบใน change เดียวกัน

ใช้ mapping ใน `docs/DOCUMENTATION_RULES.md`

## 10. Finish

สรุปผล ไฟล์ที่เปลี่ยน การตรวจสอบที่รัน และข้อจำกัดที่ยังเหลือ

อัปเดต `docs/CHANGELOG.md`, `docs/TODO.md` และ `docs/ROADMAP.md` เมื่อสถานะโครงการเปลี่ยน

# Mandatory Rules

- ห้ามแก้ไฟล์ที่ไม่เกี่ยวข้อง
- ห้ามเดา Business Logic
- ห้ามสร้าง API ที่ไม่มี requirement หรือหลักฐาน
- ห้ามสร้าง Database Field หรือ Relation โดยพลการ
- ห้ามลบ Feature โดยไม่อธิบายและไม่ได้รับอนุญาต
- ห้าม Refactor unrelated code
- ห้าม Rename public API, Route, Field หรือ File โดยไม่แจ้งผลกระทบ
- ห้ามใช้ `any`
- ห้าม Hard-code secret, credential, price, role, user identity หรือ environment-specific URL
- ห้าม Duplicate Code หรือ Duplicate Business Calculation
- ห้ามนำ Prisma หรือ server secret เข้า Client Component
- ห้ามแก้ migration ที่ deploy แล้ว
- ห้ามลด assertion หรือ skip test เพื่อให้ผ่าน
- Prefer reusable components
- Prefer composition over inheritance
- Prefer Server Components เมื่อไม่ต้องใช้ client capability
- Prefer TypeScript strict และ explicit types
- Prefer small, reversible changes
- Preserve backward compatibility เมื่อ requirement ไม่ได้อนุญาตให้ breaking change

# Definition of Done

งานถือว่าเสร็จเมื่อเงื่อนไขที่เกี่ยวข้องครบทั้งหมด:

- Acceptance criteria ผ่าน
- Build ผ่าน
- Lint ผ่าน
- ไม่มี TypeScript errors
- Tests ตามระดับความเสี่ยงผ่าน
- ไม่มี duplicated business logic ใหม่
- ไม่มี unrelated change
- Error handling ครบ
- Security และ permission ได้รับการตรวจ
- Accessibility ได้รับการตรวจเมื่อแก้ UI
- Migration และ rollback plan พร้อมเมื่อแก้ Database
- Documentation อัปเดต
- `docs/CHANGELOG.md` อัปเดต
- `docs/TODO.md` อัปเดต
- `docs/ROADMAP.md` อัปเดตเมื่อ milestone หรือ priority เปลี่ยน

หากข้อใดทำไม่ได้ ให้ระบุเป็น Unverified หรือ Remaining Work อย่างชัดเจน

# Documentation Policy

- Code behavior เปลี่ยน: อัปเดตเอกสารที่อธิบาย behavior นั้น
- Database เปลี่ยน: อัปเดต `docs/DATABASE.md`
- API หรือ Server Action เปลี่ยน: อัปเดต `docs/API.md`
- Business Logic เปลี่ยน: อัปเดต `docs/BUSINESS_RULES.md`
- Module เปลี่ยน: อัปเดต `docs/MODULES.md`
- Architecture เปลี่ยน: อัปเดต `docs/ARCHITECTURE.md` และ `docs/DECISIONS.md` เมื่อเป็นการตัดสินใจสำคัญ
- Dependency เปลี่ยน: อัปเดต `docs/DEPENDENCIES.md`
- Environment เปลี่ยน: อัปเดต `docs/ENVIRONMENT.md`
- Risk หรือ Technical Debt เปลี่ยน: อัปเดต `docs/KNOWN_ISSUES.md` และ `docs/TODO.md`
- ทุก release หรือการเปลี่ยนแปลงที่ส่งมอบ: อัปเดต `docs/CHANGELOG.md`

ห้ามใส่ secret, token, credential หรือ PII ใน Documentation

# Code Quality Rules

- Code ต้องอ่านง่ายและสื่อ Domain
- Function ต้องทำหน้าที่เดียวและมีขนาดเหมาะสม
- Component ต้องมี responsibility ชัดเจน
- แยก reusable behavior เมื่อมีการใช้ซ้ำจริง
- ใช้ named types สำหรับ Props และ DTO ที่ซับซ้อน
- ห้าม Dead Code และ commented-out implementation ที่ไม่มีแผน
- ห้าม Magic Numbers; ใช้ constant หรือ Domain configuration
- Error ต้องถูก handle และสื่อสารอย่างเหมาะสม
- Error ที่ไม่คาดคิดต้อง log โดยไม่เปิดเผย secret หรือ PII
- Request body ต้องมี runtime validation
- Financial calculation ต้องมี test และใช้ source of truth เดียว

อ่านมาตรฐานเต็มที่ `docs/CODING_STANDARD.md` และ `docs/CODE_REVIEW_GUIDE.md`

# Security Rules

- ห้ามเปิดเผยหรือ commit secrets
- เมื่อพบ secret leakage ให้หยุดและรายงานทันที
- Validate input ทุก trust boundary
- Authenticate และ Authorize ทุก mutation
- Follow Supabase RLS และ least privilege เมื่อมี policy
- Prefer server-side operations สำหรับราคา สิทธิ์ สถานะ และข้อมูลสำคัญ
- ห้ามเชื่อราคา role owner หรือ status จาก client
- ห้าม log password, token, connection string, PII หรือ payment detail
- Financial mutation ต้องคำนึงถึง transaction, concurrency, idempotency และ audit trail

อ่าน `docs/SECURITY.md` และ `docs/SECURITY_GUIDE.md`

# Performance Rules

- หลีกเลี่ยง N+1 และ nested include ที่เกินจำเป็น
- ใช้ `select`, index และ pagination สำหรับ query ที่โตได้
- หลีกเลี่ยง unnecessary renders และ client boundary ที่ไม่จำเป็น
- ใช้ caching เฉพาะข้อมูลที่ยอม stale ได้และมี invalidation strategy
- Lazy load เฉพาะส่วนที่หนักหรือไม่จำเป็นต่อ initial render
- วัดผลก่อนและหลัง optimization
- ห้ามแลก Correctness หรือ Security กับ Performance

อ่าน `docs/PERFORMANCE.md` และ `docs/PERFORMANCE_GUIDE.md`

# AI Behavior

- อธิบาย major changes ก่อน implementation
- จัดทำ implementation plan สำหรับงานหลายขั้น
- ระบุ affected files ก่อนหรือระหว่างทำงาน
- ตรวจ Source Code ก่อนสรุปข้อเท็จจริง
- ไม่สร้าง Feature เพิ่มเอง
- ไม่ขยายขอบเขตเพราะเห็นว่า “ควรทำ”
- แจ้ง blocker โดยเร็วพร้อมหลักฐาน
- ขออนุญาตก่อน destructive หรือ externally visible action
- ไม่ซ่อน test failure, warning หรือ limitation
- ไม่เขียน Final Answer ที่ต้องพึ่ง commentary ก่อนหน้า

# References

คู่มือนี้สรุปกฎเท่านั้น รายละเอียดให้อ่านจาก:

- `docs/PROJECT_OVERVIEW.md` — ตัวตนและสถานะโครงการ
- `docs/ARCHITECTURE.md` — Architecture และ Data Flow
- `docs/DATABASE.md` — Prisma Models, Relations และ Constraints
- `docs/API.md` — Route Handlers และ Contracts
- `docs/BUSINESS_RULES.md` — Business Rules ที่ยืนยันแล้ว
- `docs/CODING_STANDARD.md` — มาตรฐานการเขียนโค้ด
- `docs/DEVELOPMENT_WORKFLOW.md` — Workflow ตั้งแต่ Requirement ถึง Deployment
- `docs/DOCUMENTATION_RULES.md` — กฎการอัปเดตเอกสาร
- `docs/TESTING_GUIDE.md` — Testing Strategy และ Definition of Done
- `docs/CODE_REVIEW_GUIDE.md` — Review Checklist
- `docs/SECURITY.md` — Security Review ปัจจุบัน
- `docs/SECURITY_GUIDE.md` — Security Standard
- `docs/PERFORMANCE.md` — Performance Review ปัจจุบัน
- `docs/PERFORMANCE_GUIDE.md` — Performance Standard
- `docs/DECISIONS.md` — Architecture Decisions
- `docs/KNOWN_ISSUES.md` — Bugs, Risks และ Technical Debt
- `docs/ROADMAP.md` — Current และ Future Direction
- `docs/TODO.md` — Prioritized Work
- `docs/CHANGELOG.md` — ประวัติการเปลี่ยนแปลง
- `docs/GLOSSARY.md` — Terminology กลางของระบบ

หากเอกสารกับ implementation ไม่ตรงกัน ให้ยืนยันจาก Source Code และแจ้งความคลาดเคลื่อนก่อนแก้ไข
