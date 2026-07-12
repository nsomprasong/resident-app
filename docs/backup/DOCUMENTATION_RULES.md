# กฎการดูแล Documentation

## Source of Truth

เอกสารต้องตรงกับ source/schema/migration จริง. ข้อที่ไม่มีหลักฐานให้เขียน “ยังไม่พบการ Implement” หรือ “ยังไม่พบเหตุผลจากโค้ด” ห้ามเดา.

## Update Matrix

| การเปลี่ยนแปลง | เอกสารที่ต้องอัปเดต |
|---|---|
| Prisma model/field/relation/index/migration | `DATABASE.md`, `CHANGELOG.md`, อาจรวม `BUSINESS_RULES.md` |
| Route/Server Action/contract/error | `API.md`, `SECURITY.md`, `CHANGELOG.md` |
| Module/feature/route UI | `MODULES.md`, `PROJECT_OVERVIEW.md`, `COMPONENTS.md` |
| Architecture/rendering/state/dependency | `ARCHITECTURE.md`, `DECISIONS.md`, `DEPENDENCIES.md` |
| Environment/deployment | `ENVIRONMENT.md`, `SECURITY_GUIDE.md`, `CHANGELOG.md` |
| Business Rule | `BUSINESS_RULES.md`, API/Database ที่เกี่ยวข้อง |
| Risk/bug/debt | `KNOWN_ISSUES.md`, `TODO.md`, `ROADMAP.md` |
| ทุก development session | `PROJECT_STATUS.md` และ append รายการใน `WORK_LOG.md` |
| สถานะ Phase/Task หรือ dependency เปลี่ยน | `IMPLEMENTATION_PLAN.md`, `PROJECT_STATUS.md`, `TODO.md`, `ROADMAP.md` ตามผลกระทบ |

## Writing Rules

- ภาษาไทยเป็นหลัก; technical term ภาษาอังกฤษได้และต้องใช้คำเดียวกันทั่วระบบ
- ระบุ path, model, endpoint หรือหลักฐานที่ตรวจสอบได้
- หลีกเลี่ยงการคัดเนื้อหาซ้ำ; ใช้ลิงก์ข้ามเอกสาร
- Mermaid ต้อง render ได้; table ต้องมีหัวข้อชัด
- ห้ามใส่ secret, PII, token หรือ credential
- เมื่อ behavior เปลี่ยน ต้องอัปเดตใน change เดียวกันก่อน merge

## Review

ตรวจความไม่ขัดกัน, terminology, link/path, version/date, fact/inference และความครบตาม Update Matrix. Documentation-only change ไม่อนุญาตให้แก้ source โดยพ่วง.
