# RBAC Test Users Setup

เอกสารนี้เป็น Task 2.3b สำหรับสร้าง Supabase Auth/Employee **E2E fixtures เท่านั้น** records เหล่านี้ไม่ใช่พนักงานใช้งานจริง ห้ามใช้บัญชีจริงและห้าม commit credential

Task 2.3 มีสถานะ `IN_PROGRESS / NOT VERIFIED` จนกว่า cross-role HTTP E2E ใน Task 2.3c จะผ่าน และห้ามขยาย API permission enforcement ระหว่างรอ fixtures

## Users ที่ต้องมี

| Employee fixture name | Role code |
|---|---|
| `e2e-rbac-reception` | `RECEPTION` |
| `e2e-rbac-housekeeping` | `HOUSEKEEPING` |
| `e2e-rbac-kitchen` | `KITCHEN` |
| `e2e-rbac-accounting` | `ACCOUNTING` |
| `e2e-rbac-manager` | `MANAGER` |

สร้างที่ Authentication > Users > Add user, เปิด Auto Confirm และใช้ password แยกกัน จากนั้นเชื่อมแต่ละ Auth UUID กับ Employee fixture คนละแถว โดยใช้ชื่อและ role code ตามตารางเท่านั้น

Role เดิม `ผู้ดูแลระบบ` เป็น legacy alias ที่ต้องเก็บไว้ชั่วคราวจนถึง Task 2.5 ห้ามแก้หรือลบ Employee เดิมใน Task 2.3b

ตัวอย่าง SQL ต่อหนึ่งบัญชี (แทน placeholder ใน SQL Editor เท่านั้น):

```sql
insert into public.employees (id, auth_user_id, name, role, created_at, updated_at)
values (
  gen_random_uuid(),
  '<auth-user-uuid>'::uuid,
  '<APPROVED_E2E_FIXTURE_NAME>',
  '<APPROVED_ROLE_CODE>',
  now(),
  now()
)
on conflict (auth_user_id) do update
set role = excluded.role,
    name = excluded.name,
    updated_at = now();
```

เพิ่ม email/password ลง local `.env` ตาม placeholders ใน `.env.example` แล้วตรวจว่า:

1. Auth user แต่ละบัญชีมี Employee mapping เพียงหนึ่งแถว
2. Role ตรงกับ approved code
3. ชื่อ Employee ตรงกับ approved fixture name และระบุได้ชัดว่าไม่ใช่พนักงานจริง
4. บัญชีเหล่านี้ไม่มีข้อมูลลูกค้าหรือ credential จริง
5. ห้ามส่ง password, UUID, URL, token หรือ key ผ่าน documentation/chat

## หลัง Provision

หยุดและแจ้งว่า fixtures/env พร้อมแล้ว ห้ามรัน cross-role E2E เองและห้ามขยาย permission enforcement; Task 2.3c จะเริ่มหลังตรวจ fixture presence/mapping แบบไม่เปิดเผยข้อมูลลับ

## Cleanup/Retention

Task 2.3d จะตัดสินใจภายหลังว่าจะเก็บ fixtures สำหรับ regression หรือขออนุมัติลบ การ provision ไม่ได้ให้สิทธิ์ลบ fixtures โดยอัตโนมัติ

การลบ test users/Employee rows เป็น destructive action ต้องขออนุมัติแยก
