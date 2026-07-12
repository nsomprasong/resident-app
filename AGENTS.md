# AGENTS.md — Resident Hotel Management

ไฟล์นี้คือคำสั่งหลักแบบประหยัด context สำหรับ AI coding agent

## กติกาการอ่าน (สำคัญที่สุด)

ทุกงานให้อ่านตามลำดับนี้เท่านั้น:

1. `AGENTS.md`
2. `docs/CURRENT_TASK.md`
3. Source Code/Schema/Test เฉพาะไฟล์ที่เกี่ยวข้อง
4. เปิด `docs/PROJECT_CONTEXT.md` หรือเอกสารใน `docs/reference/` เฉพาะเมื่อจำเป็น

**ห้ามอ่านทั้งโฟลเดอร์ `docs/` ซ้ำทุกงาน** และ **ห้ามอ่าน `docs/archive/`** เว้นแต่ผู้ใช้สั่งหรือข้อมูลจำเป็นหายไป

## เป้าหมายโครงการ

Resident Hotel Management คือระบบจัดการที่พัก ห้อง/แพ การจอง ลูกค้า อาหาร ค่าใช้จ่าย การรับเงิน คืนเงิน และตรวจห้องหลังเช็กเอาต์

Stack หลัก: Next.js App Router, React, TypeScript strict, Tailwind, Prisma, Supabase PostgreSQL, Supabase Auth และ Playwright

ตรวจเวอร์ชันจริงจาก `package.json` เสมอ

## วิธีทำงานแบบประหยัด Token/Credit

- ค้นหาเฉพาะไฟล์ที่เกี่ยวข้องก่อนอ่านเต็มไฟล์
- ใช้ `rg`, `git diff`, test เฉพาะจุด และ existing scripts แทนการสแกนทั้ง repository
- ไม่สรุป repository ใหม่ หาก `docs/CURRENT_TASK.md` ยังตรงกับ Source Code
- ไม่สร้างเอกสาร/รายงาน/แผนใหม่โดยอัตโนมัติ
- ไม่อัปเดต `ROADMAP`, `TODO`, `CHANGELOG`, `WORK_LOG` ทุกครั้ง
- อัปเดตเฉพาะ `docs/CURRENT_TASK.md` เมื่อสถานะงานเปลี่ยนจริง
- อัปเดต `CHANGELOG.md` เฉพาะเมื่อส่งมอบ feature/fix ที่ผู้ใช้ยอมรับหรือเตรียม release
- ตอบผู้ใช้สั้น: ผลลัพธ์, ไฟล์ที่แก้, verification, blocker เท่านั้น
- อย่าทำงานนอกขอบเขตเพื่อ “ปรับปรุงเพิ่ม”

## Workflow

1. อ่านคำขอและ `docs/CURRENT_TASK.md`
2. ตรวจ `git status --short` และรักษา user changes
3. ค้น Source Code/Schema/Test ที่เกี่ยวข้อง
4. วางแผนสั้น 2–5 ขั้นเฉพาะงานหลายขั้น
5. แก้เฉพาะไฟล์จำเป็น
6. รัน verification ที่ตรงความเสี่ยง
7. อัปเดต `docs/CURRENT_TASK.md` เฉพาะเมื่อ task status/evidence เปลี่ยน
8. สรุปโดยไม่อ้างว่าผ่านหากไม่ได้รันจริง

## กฎบังคับ

- Source Code และ Prisma Schema ปัจจุบันมีอำนาจเหนือเอกสาร
- ห้ามเดา Business Rule, API, field, relation, role หรือ permission
- ห้ามใช้ `any`
- ห้าม hard-code secret, credential, price, role, user identity หรือ environment URL
- ห้ามนำ Prisma/server secret เข้า Client Component
- Authenticate และ Authorize ทุก mutation ที่เกี่ยวข้อง
- ราคา สิทธิ์ สถานะ และยอดเงินต้องตรวจฝั่ง Server
- Financial/availability mutation ต้องพิจารณา validation, transaction, concurrency และ idempotency
- ห้ามแก้ migration ที่ deploy แล้ว
- ห้าม unrelated refactor, rename public contract หรือ formatting ทั้งไฟล์
- ห้ามลด assertion, skip test หรือลบ feature เพื่อให้ test ผ่าน
- ห้าม destructive action เช่น reset DB, ลบข้อมูล/ไฟล์, rewrite history โดยไม่ได้รับอนุญาต
- Unknown role/permission ต้อง fail closed
- UI guard ใช้เพื่อ UX; Server/API guard คือ security boundary

## Verification

เลือกให้เหมาะกับงาน ไม่จำเป็นต้องรันทุกคำสั่งทุกครั้ง:

- งานเล็กเฉพาะจุด: targeted test + lint/typecheck เฉพาะที่มี
- API/Auth/RBAC/Business Logic: targeted tests และ regression ที่เกี่ยวข้อง
- ก่อนประกาศ task/milestone เสร็จ: `npm run lint`, `npx tsc --noEmit`, `npm run build` และ tests ที่เกี่ยวข้อง

ถ้าคำสั่งไม่มีหรือรันไม่ได้ ให้รายงาน `UNVERIFIED` พร้อมเหตุผล

## Definition of Done

งานเสร็จเมื่อ acceptance criteria ของ `docs/CURRENT_TASK.md` ผ่าน, ไม่มี unrelated changes, verification ที่จำเป็นผ่าน และสถานะ/evidence ถูกบันทึกอย่างย่อ

## เอกสารอ้างอิง

- `docs/CURRENT_TASK.md` — งานเดียวที่กำลังทำ, blocker, next action
- `docs/PROJECT_CONTEXT.md` — architecture, domain, security และกฎถาวรแบบย่อ
- `docs/REFERENCE_INDEX.md` — เปิดรายละเอียดตามประเภทงาน
- `docs/reference/` — เอกสารเชิงลึกที่ยังใช้งาน
- `docs/archive/` — เอกสารเดิม/ประวัติ ห้ามอ่านตามปกติ
