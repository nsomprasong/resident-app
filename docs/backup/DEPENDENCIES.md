# Dependencies

## Supabase Authentication

- `@supabase/ssr` `^0.12.0`: browser/server clients และ cookie-based SSR session
- `@supabase/supabase-js` `^2.109.0`: Supabase Auth client
- เพิ่มใน Task 1.2 ตามเอกสาร Supabase SSR สำหรับ Next.js App Router
- Install audit baseline: 13 vulnerabilities (8 moderate, 4 high, 1 critical); ยังไม่รัน automatic fix เพราะอาจมี breaking dependency changes
- Engine warning: `@prisma/streams-local@0.1.2` ต้องการ Node 22/Bun ตาม metadata ขณะที่ runtime ปัจจุบันเป็น Node 20.19.6; lint/type/build ยังผ่าน

## E2E Testing

- `@playwright/test`: browser E2E runner (dev dependency)
- Playwright Chromium 1228 / Chrome for Testing 149.0.7827.55 ติดตั้งใน local browser cache
- Test artifacts และ authenticated storage state ห้าม commit

| Package | หน้าที่ | จุดใช้งาน/สถานะ |
|---|---|---|
| next | App Router, Route Handler, Image/Link/navigation | แกนหลักทั่ว `app/`/components |
| react, react-dom | UI/runtime | แกนหลัก |
| typescript | static typing | strict/noEmit |
| tailwindcss, @tailwindcss/postcss | utility CSS | `styles/globals.css`, className ทั่ว UI |
| prisma, @prisma/client | schema/migration/generated API | Prisma CLI และ generated client |
| @prisma/adapter-pg, pg | PostgreSQL driver adapter | `lib/prisma.ts`, seed |
| @reduxjs/toolkit, react-redux | client state | basket/book detail |
| lucide-react | icons | layout/UI จำนวนมาก |
| dotenv | โหลด env สำหรับ Prisma/seed | `prisma.config.ts`, seed |
| uuid | client basket row id | `AddMenuDialog` |
| eslint, eslint-config-next, @eslint/eslintrc | lint | `eslint.config.mjs` |
| tsx | รัน seed TypeScript | `npm run db:seed` |
| @types/* | TypeScript declarations | development |
| promptpay-qr | เคยใช้ QR แต่ปัจจุบันไม่พบ import ใน source | มีแนวโน้ม unused |
| @types/qrcode | type ของ package QR ที่ไม่อยู่ใน dependency/source ปัจจุบัน | unused |

## Scripts

`dev`, `build`, `start`, `lint`, `postinstall`, `db:generate`, `db:validate`, `db:migrate`, `db:deploy`, `db:studio`, `db:seed`.

## ข้อควรตรวจต่อ

- ยืนยันและถอด `promptpay-qr`/`@types/qrcode` หาก QR ถูกพักถาวร
- `allowJs` เปิดอยู่แต่ไม่พบ JS application source
- package-lock ควรสอดคล้อง package.json และผ่าน dependency audit ใน CI
