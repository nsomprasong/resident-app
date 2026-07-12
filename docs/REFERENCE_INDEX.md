# Reference Index — Read Only What the Task Needs

ห้ามเปิดทุกไฟล์ เลือกตามประเภทงาน:

| งาน | อ่านเพิ่มเฉพาะไฟล์ |
|---|---|
| RBAC/Auth ปัจจุบัน | `reference/RBAC_PLAN.md`, `reference/RBAC_TEST_USERS_SETUP.md`; แล้วดู tests/source ที่เกี่ยวข้อง |
| API contract | `reference/API.md` + Route Handler ที่เกี่ยวข้อง |
| Database/Prisma | `reference/DATABASE.md` + `prisma/schema.prisma` + migrations เฉพาะที่เกี่ยวข้อง |
| Booking/ราคา/Payment/Refund | `reference/BUSINESS_RULES.md` + source/test ของ flow นั้น |
| Architecture change | `reference/ARCHITECTURE.md`, `reference/DECISIONS.md` |
| Environment/Auth setup | `reference/ENVIRONMENT.md` และ setup guide ที่เกี่ยวข้อง |
| Security review | `reference/SECURITY.md`, `reference/SECURITY_GUIDE.md` |
| Testing | `reference/TESTING_GUIDE.md` + `package.json` scripts |
| Dependency change | `reference/DEPENDENCIES.md` + lockfile/package.json |
| Module/UI | `reference/MODULES.md`, `reference/COMPONENTS.md` เฉพาะเมื่อหาใน source ไม่พอ |

## เอกสารที่ไม่ต้องอ่านตามปกติ

ไฟล์ใน `archive/` เป็น snapshot, audit, log, roadmap และแผนเก่าที่เก็บเพื่อประวัติเท่านั้น เช่น:

- `WORK_LOG.md`
- `IMPLEMENTATION_PLAN.md`
- `PROJECT_STATUS.md`
- `TODO.md`
- `ROADMAP.md`
- verification/audit reports เก่า

ใช้ `git log`, `git diff` และ `CURRENT_TASK.md` แทนการอ่านประวัติยาว
