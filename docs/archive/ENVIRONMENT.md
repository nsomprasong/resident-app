# Environment และการติดตั้ง

## Environment Variables

| Variable | ใช้ที่ | หน้าที่ |
|---|---|---|
| `DATABASE_URL` | `lib/prisma.ts`, `prisma/seed.ts` | runtime/seed PostgreSQL connection ผ่าน pooler |
| `DIRECT_URL` | `prisma.config.ts` | migration connection |
| `NEXT_PUBLIC_API_URL` | ไม่พบการใช้ใน source ปัจจุบัน | legacy API URL |
| `NEXT_PUBLIC_PROMPTPAY_ID` | ไม่พบการใช้หลังพัก QR | legacy PromptPay recipient |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/*` | Supabase project URL สำหรับ Auth; เป็น public configuration |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `lib/supabase/*` | Supabase publishable key สำหรับ Auth; ห้ามใช้ service-role key |
| `E2E_AUTH_EMAIL` | Playwright Auth tests | Dedicated test user email; local/CI secret เท่านั้น |
| `E2E_AUTH_PASSWORD` | Playwright Auth tests | Dedicated test user password; local/CI secret เท่านั้น |
| `E2E_EXPIRY_SUPABASE_URL` | Isolated expiry test | URL ของ Supabase test project; ต้องไม่ตรง application project |
| `E2E_EXPIRY_SUPABASE_PUBLISHABLE_KEY` | Isolated expiry test | Publishable key ของ test project; ห้ามใช้ secret/service role |
| `E2E_EXPIRY_AUTH_EMAIL` | Isolated expiry test | Test-only Auth email; local/CI secret |
| `E2E_EXPIRY_AUTH_PASSWORD` | Isolated expiry test | Test-only Auth password; local/CI secret |
| `NODE_ENV` | `lib/prisma.ts` | cache Prisma singleton เฉพาะ non-production |

ห้ามบันทึกค่าจริงในเอกสารหรือ Git. วันที่ 2026-07-11 ได้เปลี่ยน `.env.example` เป็น placeholders, สแกน Git history 9 revisions โดยไม่พบ connection string ตามรูปแบบที่กำหนด และเจ้าของยืนยันว่า rotate credential พร้อมอัปเดต local `.env` แล้ว การตรวจ `prisma migrate status` เชื่อมต่อสำเร็จและยืนยันว่า database schema เป็นปัจจุบัน

## Runtime Requirements

- README ระบุ Node.js 20.19+
- CA certificate ต้องอยู่ `certs/prod-ca-2021.crt`; หากไม่มี runtime และ seed จะอ่านไฟล์ไม่สำเร็จ
- `DATABASE_URL` ถูก parse ด้วย `URL`; code ลบ query `sslmode` แล้วใช้ adapter SSL config

## คำสั่ง

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Development ใช้ `localhost:3000`. ไม่พบ Docker, CI/CD, deployment manifest หรือ environment-specific configuration อื่น.
