# มาตรฐานการเขียนโค้ด

## หลักทั่วไป

ใช้ TypeScript strict, UTF-8, explicit domain naming และ formatter/lint เดียวกันทั้ง repository. ห้าม `any`, secret, magic price, duplicate calculation และ silent error. เปลี่ยนเฉพาะขอบเขตงานและรักษา backward compatibility.

## TypeScript

- DTO, Props และ domain command ที่ซับซ้อนต้องมี named type
- Request/response ต้องแยกจาก Prisma type และตรวจ runtime
- ใช้ enum/union แทน string กระจัดกระจาย
- ใช้ `unknown` ใน catch แล้ว narrow
- เงินใช้ Prisma Decimal ใน DB; boundary แปลงอย่างตั้งใจและห้าม floating-point calculation ซับซ้อนโดยไม่มี test

## React/Next.js

- Server Component เป็นค่าเริ่มต้น; Client Component ต้องมีเหตุผล
- แยก data fetching, state orchestration และ presentation เมื่อไฟล์เริ่มมีหลายหน้าที่
- ใช้ controlled form อย่างสม่ำเสมอ; loading/error/empty/disabled ต้องครบ
- ห้าม GET ทำ mutation; Route Handler ต้องตรวจ auth/validation ก่อน DB
- ห้าม Prisma หรือ server secret หลุดเข้า client bundle

## Prisma/Database

- mutation หลายตารางใช้ transaction
- query ใช้ `select` เท่าที่จำเป็นและอาศัย index
- snapshot ราคาไว้ใน item transaction
- unique/check/relation invariant ควรอยู่ DB เมื่อทำได้
- migration ที่ deploy แล้ว immutable

## Formatting และ Naming

- Component/Type/Enum: PascalCase
- variable/function/hook: camelCase
- database physical name: snake_case ผ่าน `@map`/`@@map`
- Boolean: `is/has/can/should`; handlers: `handleX`; fetch/load mutation: verb ที่สื่อผล
- ไฟล์ component ตรงกับชื่อ export; แก้ typo ด้วย deprecation/rename plan

## Error และ Logging

ใช้ error contract สม่ำเสมอ เช่น `{ code, message, details? }`; 400 validation, 401 unauthenticated, 403 unauthorized, 404 missing, 409 conflict, 422 domain rule และ 500 unexpected. Log ต้องมี request/entity id แต่ไม่มี PII/secret.

## Imports และ Dependency

เรียง external → alias `@/` → relative. ห้ามเพิ่ม package หาก native/platform capability เพียงพอ; ทุก package ใหม่ต้องมีเหตุผล, license/security check และอัปเดต `DEPENDENCIES.md`.
