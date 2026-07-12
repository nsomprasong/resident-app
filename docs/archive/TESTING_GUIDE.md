# Testing Guide

## Phase 0 Baseline — 2026-07-11

- `npm run lint`: ผ่าน
- `npx tsc --noEmit`: ผ่านภายใต้ TypeScript strict
- `npm run build`: ผ่านด้วย Next.js 15.5.3/Turbopack; static page generation 20/20
- Automated tests: ยังไม่มี test script/framework ใน repository

## Playwright Auth E2E — 2026-07-11

- `npm run test:e2e`: Chromium E2E tests
- Test server ใช้ port 3100 และ generated directory `.next-test` แยกจาก `.next`
- Auth state, reports และ test results ถูก ignore
- Unauthenticated suite: 4/4 ผ่าน ครอบคลุม public Login, protected page redirect, API 401 JSON และ public Logout endpoint
- Authenticated suite: 2/2 ผ่าน ครอบคลุม generic invalid-login error และ dedicated Login/Employee identity/local Logout/protected redirect
- Auth E2E 7/7 ผ่าน รวม controlled global revocation ที่ยืนยันว่า refresh token เดิมใช้ต่อไม่ได้
- API guard coverage 17/17 ผ่าน; full Auth suite รวม 24/24 ผ่าน
- Application page guard coverage 12/12 ผ่าน; full Auth suite รวม 36/36 ผ่าน
- Targeted revocation rerun 1/1 ผ่านหลัง TypeScript validation fix
- Wall-clock access-token expiry/automatic refresh/revocation ผ่านใน approved controlled window และยืนยัน rollback TTL เป็นค่าเดิมแล้ว

ปัจจุบัน repository ยังไม่พบ automated test framework หรือ test files; ข้อกำหนดนี้เป็นมาตรฐานเป้าหมายและต้องเลือกเครื่องมือผ่าน ADR ก่อนติดตั้ง.

## Unit Test

ทดสอบ pure/domain logic: date overlap, nights, group package, extra order, grand/paid/refundable, booking transition, inspection completion. ครอบคลุม zero, negative, boundary date, timezone และ Decimal rounding.

## Integration Test

ทดสอบ Route Handler + test database: transaction atomicity, unique/conflict, payment/refund concurrency, server-side catalog pricing, close job และ room status. Test ต้อง isolate/rollback data และห้ามใช้ production Supabase.

## E2E

Critical journeys:

1. สร้างรายเดี่ยว/กลุ่ม → ยืนยัน → เช็กอิน → เช็กเอาต์ → ตรวจทุกห้อง → ปิดงาน
2. รับมัดจำ/ชำระหลายงวด
3. ยกเลิก → คืนบางส่วน/เต็มจำนวน
4. สั่งอาหาร → รายการ extra เข้ายอด
5. availability ห้อง/แพและ conflict

## Regression

ทุก bug fix ต้องมี test ที่ fail ก่อน fix. Financial/status/date/security bug ต้องเพิ่ม integration หรือ E2E ไม่ใช่ snapshot อย่างเดียว.

## Definition of Done

- Acceptance criteria ผ่าน
- Unit/integration/E2E ตาม risk ผ่าน
- Lint, type check, build ผ่าน
- ไม่มี flaky/skip test ที่ไม่อธิบาย
- Security/accessibility/manual smoke test ผ่านตามขอบเขต
- Docs, CHANGELOG, TODO อัปเดต
