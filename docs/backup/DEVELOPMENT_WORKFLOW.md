# Development Workflow

## 1. Requirement

ระบุ objective, actor, acceptance criteria, out-of-scope, data/security impact และความเข้ากันได้ย้อนหลัง. ถ้า requirement ขัด Business Rule ให้หยุดยืนยันก่อน.

## 2. Analysis

อ่าน `AI/AGENTS.md`, docs ที่เกี่ยวข้อง และ source จริง. ทำ impact map ต่อ UI/API/DB/test/docs. สำหรับ bug ให้มี reproduction และ root-cause hypothesis ที่ตรวจสอบได้.

## 3. Design

เลือก change ที่เล็กและ reversible. Database/API/Architecture change ต้องมี ADR หรืออัปเดต `DECISIONS.md`. เตรียม migration/rollback, validation, permission และ test matrix.

## 4. Implementation

ทำเป็นชุดเล็ก รักษา user changes ไม่แก้ unrelated file. Server เป็นผู้ตัดสินราคา/สิทธิ์/state transition. เพิ่มหรือปรับ test พร้อม code.

## 5. Testing

รัน unit → integration → E2E ตาม risk, แล้ว `npm run lint`, type check และ `npm run build`. ตรวจ happy path, boundary, permission, error, concurrency และ regression.

## 6. Review

Reviewer ใช้ `CODE_REVIEW_GUIDE.md`; ตรวจ requirement traceability, security, data integrity, performance, accessibility, documentation และ rollback.

## 7. Deployment

ตรวจ environment/secrets/backup, deploy migration แบบ compatible, deploy app, smoke test critical journeys, monitor error/latency/data และ rollback หาก threshold เกิน.

## 8. Close Work

อัปเดต docs ตาม `DOCUMENTATION_RULES.md`, `CHANGELOG.md`, `TODO.md`; สรุปไฟล์ที่เปลี่ยน การทดสอบที่รัน ความเสี่ยง และงานค้าง.
