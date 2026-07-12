# Auth Expiry Test Setup

แนวทางปกติให้ใช้ Supabase project/branch แยก หากเจ้าของระบบยืนยันว่า project ไม่มีผู้ใช้งานจริงและอนุมัติความเสี่ยงอย่างชัดเจน สามารถใช้ development project ปัจจุบันแบบชั่วคราวได้ โดยต้องบันทึกค่าเดิม คืนค่าในทุกกรณี และตรวจ TTL หลัง rollback

## 1. เลือก Test Environment

1. ยืนยันว่าไม่มีผู้ใช้งานจริงที่ได้รับผลกระทบ
2. ใช้ dedicated Auth test user แยกจากผู้ดูแลและบัญชีทั่วไป
3. บันทึก JWT expiry เดิมโดยไม่บันทึก secret
4. ขออนุมัติก่อนเปลี่ยน external configuration

Expiry test ใช้เฉพาะ Auth API จึงไม่ต้อง deploy Prisma schema หรือ seed business data

## 2. ตั้ง JWT Expiry

ไปที่ Project Settings > JWT Keys > Legacy JWT Secret แล้วตั้ง Access token expiry เป็น 300 วินาทีเฉพาะช่วงทดสอบ

Supabase ไม่แนะนำค่าต่ำกว่า 5 นาที จึงใช้ 300 วินาทีพร้อม safety buffer ใน test

## 3. สร้าง Test User

ไปที่ Authentication > Users > Add user

- ใช้อีเมลเฉพาะ expiry test
- ตั้งรหัสผ่านใหม่ที่ไม่ซ้ำกับบัญชีจริง
- เปิด Auto Confirm User
- ไม่ต้องสร้าง Employee mapping เพราะ test เรียก isolated Auth API โดยตรง

## 4. Project URL และ Publishable Key

- Project URL: จาก Connect dialog
- Publishable key: Settings > API Keys
- ห้ามใช้ secret key หรือ service_role

## 5. Local Environment

เพิ่ม E2E_EXPIRY_SUPABASE_URL, E2E_EXPIRY_SUPABASE_PUBLISHABLE_KEY, E2E_EXPIRY_AUTH_EMAIL และ E2E_EXPIRY_AUTH_PASSWORD ใน local `.env` เท่านั้น

ห้ามส่งค่าผ่านแชตและห้าม commit

## 6. Safety Check

ก่อน test ต้องยืนยัน:

- environment และ test user ตรงกับ scope ที่ได้รับอนุมัติ
- access-token TTL อยู่ในช่วงที่คาดสำหรับ 300 วินาที
- test ไม่เรียก database/business APIs

หากข้อใดไม่ผ่าน test ต้องหยุดก่อนรอ token expiry

## Cleanup

คืน JWT expiry เป็นค่าเดิมทันทีไม่ว่าทดสอบผ่านหรือล้มเหลว จากนั้น sign-in ใหม่และยืนยัน `expires_in` ว่าตรงกับค่าเดิม ห้ามบันทึก token, password, URL หรือ key ในเอกสาร

## ผลการทดสอบ 2026-07-11

- เจ้าของยืนยันว่าไม่มีผู้ใช้งานจริงและอนุมัติการใช้ project ปัจจุบัน แม้ Dashboard แสดง `main / PRODUCTION`
- ค่าเดิม: 3600 วินาที; ค่าทดสอบ: 300 วินาที
- targeted wall-clock suite ใช้ 313 วินาทีและผ่าน 2/2
- access token เดิมถูกปฏิเสธหลัง `exp`; refresh token ออก access token ใหม่และใช้งานได้
- refresh token ของ session ที่ถูก revoke ถูกปฏิเสธ
- คืนค่าเดิมแล้ว และ Auth server ยืนยัน token ใหม่มี `expires_in=3600`
- ไม่มีการเปลี่ยน Project URL, key, Prisma schema, database data หรือ seed

การลบ test user หรือ test project เป็น destructive external action ต้องขออนุมัติแยก
