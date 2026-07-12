# โครงสร้างโฟลเดอร์

```text
app/                 Next.js App Router pages และ Route Handlers
components/layout/   Header, Sidebar, MainLayout
components/ui/       ฟอร์ม, modal, selector, card และ bill components
hooks/               Redux wrapper hooks
store/               Redux Toolkit store/slices
interface/           TypeScript interface ฝั่ง UI แบบ legacy
lib/                 Prisma singleton และ UI constants
prisma/              schema, seed และ migration history
generated/           Prisma Client ที่ generate (ถูก ignore)
styles/              Tailwind/global CSS และ local fonts declaration
public/              รูปอาหาร ห้อง มินิบาร์ และ fonts
certs/               CA certificate สำหรับ PostgreSQL TLS
docs/                เอกสารสถาปัตยกรรมและเทคนิค
AI/                  คู่มือปฏิบัติงานถาวรสำหรับ AI Agent
theme/               ไฟล์ theme เดิมถูกลบใน working tree
```

## ไฟล์สำคัญ

- `app/layout.tsx`: root metadata/layout
- `components/layout/MainLayout.tsx`: Redux Provider และ responsive shell
- `app/api/bookings/route.ts`: create/list booking และ pricing หลัก
- `app/api/bookings/[bookingId]/route.ts`: detail, lifecycle, close job
- `lib/prisma.ts`: database adapter/TLS/singleton
- `prisma/schema.prisma`: source of truth ของ data model
- `prisma/seed.ts`: master data เริ่มต้น
- `prisma.config.ts`: migration datasource
- `docs/IMPLEMENTATION_PLAN.md`: แผน Phase, dependency และ Acceptance Criteria
- `docs/PROJECT_STATUS.md`: สถานะล่าสุดแบบสั้น
- `docs/WORK_LOG.md`: ประวัติการทำงานแบบ append-only
- `.env.example`: ตัวอย่าง environment แต่ปัจจุบันมี credential จริง เป็นความเสี่ยงร้ายแรง

## โฟลเดอร์ที่ร้องขอแต่ไม่พบ

ไม่พบ `services/`, `middleware/`, `utils/` หรือ Server Actions. Business Logic จึงอยู่ใน API files และ Client Components เป็นหลัก.
