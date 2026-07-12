# Dedicated Auth Test User Setup

ใช้สำหรับ Playwright Auth E2E เท่านั้น ห้ามใช้บัญชี Admin จริง

## 1. สร้าง Auth User

ใน Supabase Dashboard ไปที่ Authentication > Users > Add user

- ใช้อีเมลสำหรับ test โดยเฉพาะ
- ตั้งรหัสผ่านที่ไม่ซ้ำกับบัญชีจริง
- เปิด Auto Confirm User สำหรับ test user
- ห้ามส่ง email/password ผ่านแชตหรือ commit ลง Git

## 2. สร้าง Employee Mapping

แทน TEST_USER_EMAIL ใน SQL ต่อไปนี้ด้วยอีเมล test user แล้วรันใน Supabase SQL Editor

    insert into public.employees (
      id,
      auth_user_id,
      name,
      role,
      created_at,
      updated_at
    )
    select
      gen_random_uuid(),
      id,
      'e2e-auth-test',
      'ผู้ดูแลระบบ',
      now(),
      now()
    from auth.users
    where lower(email) = lower('TEST_USER_EMAIL')
    on conflict (auth_user_id)
    do update set
      name = excluded.name,
      role = excluded.role,
      updated_at = now();

การใช้ role ผู้ดูแลระบบเป็นค่าชั่วคราวตาม role ที่ยืนยันแล้วในระบบปัจจุบัน Tests ใน Phase 1 ต้องไม่เปลี่ยน business data และ Phase 2 ต้องกำหนด role vocabulary/RBAC อย่างเป็นทางการ

## 3. ตั้ง Local Environment

เพิ่ม E2E_AUTH_EMAIL และ E2E_AUTH_PASSWORD ใน local `.env` เท่านั้น โดยใช้ค่าของ dedicated test user

`.env` ถูก ignore และ Playwright auth state/report/results ถูก ignore แล้ว

## 4. Verification

หลังตั้งค่า ให้ตรวจเฉพาะ presence ของ keys และ Employee mapping โดยห้ามพิมพ์ email/password/UUID จากนั้นจึงเพิ่ม authenticated E2E tests

## Cleanup

การลบ test Auth user หรือ Employee mapping เป็น destructive external action ต้องขออนุมัติก่อน
