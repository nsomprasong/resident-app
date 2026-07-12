# Auth Verification Plan

สถานะ: Completed — Auth regression 37/37 และ controlled wall-clock expiry/refresh/revocation 2/2 ผ่าน พร้อมยืนยัน rollback TTL

## เป้าหมาย

ปิด verification gaps ของ Phase 1 โดยไม่ใช้บัญชี Admin จริงเป็น test fixture และไม่เก็บ password/session state ใน Git

## Test Foundation ที่เสนอ

- [x] ใช้ Playwright Test สำหรับ browser E2E และ HTTP/API assertions
- [x] เพิ่ม dev dependency @playwright/test
- [x] ติดตั้ง Chromium browser สำหรับ Playwright
- [x] เพิ่ม scripts: test:e2e และ test:e2e:ui
- [x] ใช้ webServer เปิด Next.js บน test port แบบอัตโนมัติ
- [x] เก็บ Playwright auth state ใน playwright/.auth และเพิ่มลง .gitignore

## Test Account Policy

- สร้าง Supabase Auth test user แยกจาก Admin
- สร้าง Employee mapping สำหรับ test user
- เก็บ email/password ใน local ignored environment เท่านั้น
- ห้ามใช้ Admin password ใน automated tests
- ห้าม commit cookies, refresh token หรือ storage state

## Test Cases

1. ไม่มี session เข้า /login ได้
2. ไม่มี session เข้า protected page ถูก redirect
3. ไม่มี session เรียก business API ได้ 401 JSON
4. Login ผิดแสดง generic error
5. Login test user สำเร็จและ Sidebar แสดง mapped Employee
6. Unmapped Auth user ถูกปฏิเสธ
7. Logout ล้าง local session และกลับ /login
8. หลัง Logout protected page/API ถูกปฏิเสธ
9. Revoked refresh session ไม่สามารถ refresh ต่อได้
10. Expired access token ใช้ refresh token ที่ยัง valid แล้วทำงานต่อ; หาก refresh ถูก revoke ต้องกลับ /login/401

## Session Scope Decision

Logout ปัจจุบันเรียก signOut โดยไม่ระบุ scope ซึ่ง Supabase กำหนด default เป็น global และอาจ logout ทุกอุปกรณ์ของผู้ใช้

ข้อเสนอ: เปลี่ยน application Logout เป็น scope local เพื่อ logout เฉพาะ session ของเครื่องปัจจุบัน ส่วน global revocation ให้เป็นคำสั่งผู้ดูแลแยกในอนาคต

## Controlled Revocation Procedure

1. Login ด้วย dedicated test user
2. เก็บ browser session ใน ignored Playwright output เท่านั้น
3. Revoke session ของ test user ผ่าน Supabase Dashboard หรือ test-only administrative procedure ที่ได้รับอนุมัติ
4. รอ access token expiry ตาม JWT setting หรือทดสอบหลัง refresh attempt
5. ยืนยัน protected page redirect และ API 401
6. สร้าง session ใหม่ให้ test user หลังทดสอบ

Access token ที่ถูกออกแล้วอาจยังใช้ได้จนถึงค่า exp แม้ refresh session ถูก revoke จึงห้ามคาดหวัง immediate denial ก่อน JWT expiry

## Risks

- Playwright browser download ใช้พื้นที่และ network
- Real Supabase test ทำ external session/data changes
- Shared test account ทำให้ parallel tests ชนกัน
- Auth state file สามารถ impersonate test user ได้หากรั่ว
- Windows .next trace lock อาจทำให้ webServer startup ไม่เสถียร

## Rollback

- ถอน scripts/config/tests และ dev dependency ได้โดยไม่แตะ business schema
- ลบ dedicated test Auth user/Employee mapping หลังได้รับอนุมัติ
- คืน Logout scope เป็น global ได้หาก business policy ต้อง logout ทุกอุปกรณ์

## Approval Required

1. ติดตั้ง @playwright/test และ Chromium
2. สร้าง dedicated Supabase test user และ Employee mapping
3. ใช้ local Logout scope แทน global scope
4. ทำ controlled revocation กับ test user เท่านั้น

Schema migration และ RLS ไม่อยู่ใน Task นี้

## References

- [PHASE_1_VERIFICATION_REPORT.md](./PHASE_1_VERIFICATION_REPORT.md)
- [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- [SECURITY.md](./SECURITY.md)
