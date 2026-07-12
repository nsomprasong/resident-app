# Access Token Expiry Verification Plan

สถานะ: Proposed — รออนุมัติ isolated Supabase test project

## Evidence

- Dedicated test user access-token TTL ปัจจุบันประมาณ 3,601 วินาที
- Local session cleanup หลังวัด TTL สำเร็จ
- Controlled global refresh-session revocation ผ่านแล้ว
- การรอหนึ่งชั่วโมงต่อ E2E run ไม่เหมาะกับ local development หรือ CI

## Decision

ไม่ลด JWT expiry ของ Supabase project ปัจจุบัน เพราะกระทบ active users ทุกคน

เสนอสร้าง Supabase test project แยกสำหรับ Auth expiry tests และกำหนด JWT expiry สั้นตามค่าต่ำสุดที่ Supabase รองรับ จากนั้นใช้ environment keys แยกจาก application environment

## Isolated Test Environment

- E2E_EXPIRY_SUPABASE_URL
- E2E_EXPIRY_SUPABASE_PUBLISHABLE_KEY
- E2E_EXPIRY_AUTH_EMAIL
- E2E_EXPIRY_AUTH_PASSWORD

ทุกค่าต้องอยู่ใน ignored local/CI secrets ห้าม commit

## Test Flow

1. Login test user ใน isolated project
2. ยืนยัน finite expires_at และ TTL สั้นตาม config
3. เก็บ access/refresh token ใน memory เท่านั้น
4. รอจน access token หมดอายุพร้อม safety buffer
5. ยืนยัน expired access token ไม่ผ่าน user verification
6. ยืนยัน valid refresh token ออก session ใหม่ได้
7. Global revoke refresh session
8. ยืนยัน refresh token เดิมถูกปฏิเสธ
9. Login ใหม่และ local cleanup

## Risks

- สร้าง external project/configuration เพิ่ม
- Test ใช้เวลาตาม minimum JWT expiry
- Credential ของ test project ต้องแยกและ rotate ได้
- หากใช้ URL/key ผิดอาจทดสอบกับ active project จึงต้องมี project-reference guard

## Safety Guard

Test ต้อง fail ก่อน Login หาก expiry project URL เท่ากับ NEXT_PUBLIC_SUPABASE_URL ของ application project

## Rollback

- ลบ local expiry-test environment keys
- ปิดหรือลบ isolated Supabase project หลังได้รับอนุมัติ destructive action
- ไม่มี schema/application data change ใน project ปัจจุบัน

## Approval Required

1. สร้าง Supabase test project แยก
2. ตั้ง JWT expiry สั้นใน test project เท่านั้น
3. สร้าง dedicated expiry Auth user
4. เพิ่ม isolated expiry environment keys ใน local `.env`

ห้ามเปลี่ยน JWT expiry ของ project ปัจจุบัน
