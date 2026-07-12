# วิธีใช้ชุดเอกสารแบบประหยัด Codex

1. สำรองโฟลเดอร์ `docs/` เดิมหรือ commit งานปัจจุบันก่อน
2. วาง `AGENTS.md` ที่ root repository
3. แทนที่ `docs/` เดิมด้วยโฟลเดอร์ `docs/` ในชุดนี้
4. เอกสารเดิมยังอยู่ครบใน `docs/archive/`
5. ให้ Codex เริ่ม thread ใหม่หนึ่งครั้งแล้วสั่งให้อ่าน `AGENTS.md` และทำตาม `docs/CURRENT_TASK.md`

คำสั่งตัวอย่าง:

> อ่าน AGENTS.md และ docs/CURRENT_TASK.md เท่านั้นก่อน จากนั้นทำ Next Allowed Action ห้ามอ่าน docs/archive และห้ามสร้างรายงานใหม่ หากต้องใช้รายละเอียดให้เปิดเฉพาะไฟล์ที่ REFERENCE_INDEX ระบุ

ผลที่ตั้งใจ:

- Default context เหลือ 2 ไฟล์
- Current task มี source of truth เดียว
- ลดการอัปเดตเอกสารซ้ำ 4–5 ไฟล์ต่อการแก้หนึ่งครั้ง
- เก็บประวัติเดิมไว้โดยไม่ให้ Codex โหลดตามปกติ
